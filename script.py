import sys
import json
import time
from scapy.all import sniff

# Global variables for speed calculation
last_time = time.time()
bytes_count = 0

def packet_callback(packet):
    global last_time, bytes_count
    
    # Initialize default values
    proto_name = "Other"
    src_ip = "N/A"
    dst_ip = "N/A"
    size = len(packet)
    bytes_count += size # Accumulate all traffic for the speed graph
    
    # 1. Check for IP Layer (TCP, UDP, ICMP, etc.)
    if packet.haslayer("IP"):
        proto = packet["IP"].proto
        src_ip = packet["IP"].src
        dst_ip = packet["IP"].dst
        
        mapping = {
            1: "ICMP", 
            2: "IGMP",
            6: "TCP", 
            17: "UDP", 
            41: "IPv6",
            89: "OSPF",
        }
        proto_name = mapping.get(proto, f"IP({proto})")
        
    # 2. Check for ARP Layer (Local hardware discovery)
    elif packet.haslayer("ARP"):
        proto_name = "ARP"
        src_ip = packet["ARP"].psrc  # ARP Source Protocol Address
        dst_ip = packet["ARP"].pdst  # ARP Destination Protocol Address

    if proto_name == "UDP" and packet.haslayer("UDP"):
        # Port 443 is the standard for QUIC (HTTP/3)
        if packet["UDP"].sport == 443 or packet["UDP"].dport == 443:
            proto_name = "QUIC"

    # 3. Calculate speed (bits per second transformed to Mbps)
    current_time = time.time()
    elapsed = current_time - last_time
    
    speed_mbps = 0
    if elapsed >= 1.0:
        # Formula: (Bytes * 8 bits) / (1024 * 1024)
        speed_mbps = (bytes_count * 8) / (1024 * 1024)
        bytes_count = 0
        last_time = current_time
    
    # 4. Prepare and send data to JS
    # We round speed_mbps to 2 decimal places
    data = [proto_name, src_ip, dst_ip, size, round(speed_mbps, 2)]
    print(json.dumps(data))
    sys.stdout.flush()

sniff(prn=packet_callback, store=0)