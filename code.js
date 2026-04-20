const logs = document.getElementById('logs');
const canvas = document.getElementById('speedGraph');
const ctx = canvas.getContext('2d');
const { spawn } = require('child_process');

const pythonPath = '/Users/hansikaiddagoda/Documents/Real-Time Network Traffic Monitor/network monitor/scapy-env/bin/python';
const pythonProcess = spawn(pythonPath, ['script.py']);

let speeds = [];
let packetQueue = [];

pythonProcess.stdout.on('data', (data) => {
    try {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            const parsed = JSON.parse(line);
            packetQueue.push(parsed);
        });
    } catch (e) {
        // Silently catch partial JSON chunks
    }
});

pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
});

function processPackets() {
    if (packetQueue.length === 0) return;

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

        speeds.push(currentPacket[4]);
        if (speeds.length > 100) speeds.shift(); // Extended graph history to 100 points
    }

    logs.scrollTop = logs.scrollHeight;
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