const logs = document.getElementById('logs');
const canvas = document.getElementById('speedGraph');
const ctx = canvas.getContext('2d');
const { spawn } = require('child_process');

const pythonPath = '/Users/hansikaiddagoda/Documents/Real-Time Network Traffic Monitor/network monitor/scapy-env/bin/python';
const pythonProcess = spawn(pythonPath, ['script.py']);

let speeds = [];
let packetQueue = [];

let isFrozen = false;
const freezeBtn = document.getElementById('freezeBtn');

freezeBtn.addEventListener('click', () => {
    isFrozen = !isFrozen;

    if (isFrozen) {
        freezeBtn.textContent = "Unfreeze Capturing";
        freezeBtn.classList.add('active');
    } else {
        freezeBtn.textContent = "Freeze Capturing";
        freezeBtn.classList.remove('active');
    }
});

pythonProcess.stdout.on('data', (data) => {
    // REQUIREMENT: If frozen, discard incoming packets (packet loss)
    if (isFrozen) return;

    try {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            const parsed = JSON.parse(line);
            packetQueue.push(parsed);
        });
    } catch (e) {
        // Handle partial chunks
    }
});

pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
});

function processPackets() {
    // REQUIREMENT: If frozen OR no packets, do nothing.
    // This keeps the current logs and graph exactly as they are.
    if (isFrozen || packetQueue.length === 0) return;

    while (packetQueue.length > 0) {
        const currentPacket = packetQueue.shift();

        // Protocol-based coloring
        let colorClass = 'red'; // Default (UDP/Other)
        if (currentPacket[0] === 'TCP') colorClass = 'green';
        if (currentPacket[0] === 'ARP' || currentPacket[0] === 'ICMP') colorClass = 'blue';

        const line = document.createElement('div');
        line.className = `line ${colorClass}`;
        line.textContent = `Protocol: ${currentPacket[0]} | SRC: ${currentPacket[1]} | DST: ${currentPacket[2]} | SIZE: ${currentPacket[3]} | SPEED: ${currentPacket[4]} Mbps`;

        logs.appendChild(line);

        // Optimization: Keep only the last 100 log entries to prevent memory lag
        if (logs.childNodes.length > 100) {
            logs.removeChild(logs.firstChild);
        }

        // Add the speed from the packet to the graph history
        speeds.push(currentPacket[4]);
        if (speeds.length > 100) speeds.shift();
    }

    // Auto-scroll to the bottom of the logs
    logs.scrollTop = logs.scrollHeight;

    // Refresh the visualization
    drawGraph();
}

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxSpeed = Math.max(...speeds, 5); // Scale to at least 5 Mbps

    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    speeds.forEach((val, i) => {
        const x = i * (canvas.width / (speeds.length - 1 || 1));
        const y = canvas.height - (val / maxSpeed) * canvas.height;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function updateUI() {
    processPackets();
    requestAnimationFrame(updateUI);
}

updateUI();