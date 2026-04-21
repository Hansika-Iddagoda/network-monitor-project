const logs = document.getElementById('logs');
const canvas = document.getElementById('speedGraph');
const ctx = canvas.getContext('2d');
const { spawn } = require('child_process');

const pythonPath = '/Users/hansikaiddagoda/Documents/Real-Time Network Traffic Monitor/network monitor/scapy-env/bin/python';
const pythonProcess = spawn(pythonPath, ['script.py']);

let speeds = [];
let packetQueue = [];
let currentMbps = 0; // Tracks the most recent speed calculation from Python
let lastPacketReceivedTime = Date.now();

let isFrozen = false;
const freezeBtn = document.getElementById('freezeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const dropdownContent = document.getElementById('dropdownContent');
const clearBtn = document.getElementById('clearBtn');
const logToggle = document.getElementById('logToggle');
const speedToggle = document.getElementById('speedToggle');
const monitorContainer = document.getElementById('monitor');

// --- Event Listeners ---
speedToggle.addEventListener('change', () => {
    // Toggles the 'hide-speed' class on the container based on checkbox state
    monitorContainer.classList.toggle('hide-speed', !speedToggle.checked);
});

clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // 1. Clear the Table Logs
    logs.innerHTML = '';
    
    // 2. Clear the Packet Queue (pending data)
    packetQueue = [];
    
    // 3. Clear the Visualizer Data
    speeds = []; 
    currentMbps = 0; // Reset current speed tracker to zero
    
    // 4. Wipe the Canvas immediately
    // This prevents the old graph line from "hanging" there until the next packet
    drawGraph(); 
});

settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents window listener from closing it immediately
    dropdownContent.classList.toggle('show');
});

// Prevent clicks inside the dropdown from closing it
dropdownContent.addEventListener('click', (e) => e.stopPropagation());

window.addEventListener('click', () => dropdownContent.classList.remove('show'));

freezeBtn.addEventListener('click', () => {
    isFrozen = !isFrozen;
    freezeBtn.textContent = isFrozen ? "Unfreeze Capturing" : "Freeze Capturing";
    freezeBtn.classList.toggle('active', isFrozen);
});

// --- Python Communication ---
pythonProcess.stdout.on('data', (data) => {
    if (isFrozen) return;
    try {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            const parsed = JSON.parse(line);
            packetQueue.push(parsed);
        });
    } catch (e) {
        // Handle potential JSON parsing errors from partial chunks
    }
});

pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));

// --- The "Heartbeat": Ensures the graph slides even during silence ---
setInterval(() => {
    if (isFrozen) return;

    const now = Date.now();
    // If no packets arrived in 1.5s, assume network is idle
    if (now - lastPacketReceivedTime > 1500) {
        currentMbps = 0;
    }

    // Force numeric conversion and push to history (100-second window)
    speeds.push(Number(currentMbps) || 0); 
    if (speeds.length > 100) speeds.shift();
}, 1000);

// Cleanup loop to maintain the 1-minute sliding window for the log table
setInterval(cleanupOldLogs, 1000);

// --- Core Logic ---
function processPackets() {
    if (isFrozen || packetQueue.length === 0) return;

    while (packetQueue.length > 0) {
        const currentPacket = packetQueue.shift();
        lastPacketReceivedTime = Date.now();

        // Data indices based on Python: [proto, src, dst, size, speed, time]
        const pProto   = currentPacket[0];
        const pSrc     = currentPacket[1];
        const pDst     = currentPacket[2];
        const pSize    = currentPacket[3];
        const pSpeed   = parseFloat(currentPacket[4]); // Ensure it's a number
        currentMbps    = isNaN(pSpeed) ? 0 : pSpeed;   // Update tracker for the heartbeat
        const pTimeRaw = currentPacket[5];

        let colorClass = 'red';
        if (pProto === 'TCP') colorClass = 'green';
        if (pProto === 'QUIC') colorClass = 'lime';
        if (pProto === 'ARP' || pProto === 'ICMP') colorClass = 'blue';

        const row = document.createElement('div');
        row.className = `line ${colorClass}`;
        // Set timestamp attribute for cleanup function
        row.setAttribute('data-timestamp', pTimeRaw);

        row.innerHTML = `
            <span>${pTimeRaw}s</span>
            <span>${pProto}</span>
            <span>${pSrc}</span>
            <span>${pDst}</span>
            <span class="col-size">${pSize} B</span>
            <span class="col-speed">${currentMbps.toFixed(2)} Mbps</span>
        `;

        logs.appendChild(row);

        if (logToggle.checked) {
            logs.scrollTop = logs.scrollHeight;
        }
    }
}

function cleanupOldLogs() {
    if (isFrozen) return;
    const allRows = logs.children;
    if (allRows.length === 0) return;

    // Use the timestamp of the newest row as the reference point
    const latestTime = parseFloat(allRows[allRows.length - 1].getAttribute('data-timestamp'));

    Array.from(allRows).forEach(row => {
        const packetTime = parseFloat(row.getAttribute('data-timestamp'));
        // Remove rows older than 60 seconds relative to the newest packet
        if (latestTime - packetTime > 60) {
            row.remove();
        }
    });
}

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Calculate Dynamic Max Speed (The "Zoom" factor)
    // We scale based on the highest value in history, with a 0.5 Mbps floor.
    const peakSpeed = Math.max(...speeds, 0.05);
    
    // 2. Draw Background Grid & Labels
    ctx.strokeStyle = '#1a331a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#006600'; 
    ctx.font = '10px Courier New';

    // Vertical grid lines every 50px
    for(let i=0; i<canvas.width; i+=50) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }

    // Dynamic Y-Axis Labels
    ctx.fillText(`${peakSpeed.toFixed(2)} Mbps`, 5, 12);
    ctx.fillText(`${(peakSpeed/2).toFixed(2)} Mbps`, 5, canvas.height/2);

    if (speeds.length === 0) return;

    // 3. Draw the Throughput Line
    // 3. Draw the Fill (Optional but recommended for visibility)
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'; // Transparent green fill
    const step = canvas.width / 99;
    
    ctx.moveTo(0, canvas.height); // Start at bottom left
    speeds.forEach((val, i) => {
        const x = i * step;
        const numericVal = parseFloat(val) || 0;
        const y = (canvas.height - 5) - (numericVal / peakSpeed) * (canvas.height - 20);
        ctx.lineTo(x, y);
    });
    ctx.lineTo(canvas.width, canvas.height); // Close the shape at bottom right
    ctx.fill();

    // 4. Draw the actual Line Stroke
    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    speeds.forEach((val, i) => {
        const x = i * step;
        const numericVal = parseFloat(val) || 0;
        const y = (canvas.height - 5) - (numericVal / peakSpeed) * (canvas.height - 20);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function updateUI() {
    processPackets();
    drawGraph();
    requestAnimationFrame(updateUI); // Syncs with monitor refresh rate
}

updateUI();