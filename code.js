const logs = document.getElementById('logs');
const canvas = document.getElementById('speedGraph');
const ctx = canvas.getContext('2d');
const { spawn } = require('child_process');

// Look inside your 'scapy-env' folder for 'bin/python'
const pythonPath = '/Users/hansikaiddagoda/Documents/Real-Time Network Traffic Monitor/Combine/scapy-env/bin/python';

const pythonProcess = spawn(pythonPath, ['script.py']);

let speeds = [];
let lastPacket = null; // Store the latest packet globally

pythonProcess.stdout.on('data', (data) => {
    try {
        // Parse the JSON string coming from Python
        lastPacket = JSON.parse(data.toString().trim());
    } catch (e) {
        // This catches partial lines or non-JSON output
    }
});

// Optional: Log errors if Python fails (like permission issues)
pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
});

function getRandomSpeed() {
    return (Math.random() * 100).toFixed(2);
}

function generateLog() {
    if (!lastPacket) return;

    // Use the speed calculated by Python (index 4)
    const currentSpeed = lastPacket[4];

    // We only push to the graph if the speed is updated or periodically
    speeds.push(currentSpeed);
    if (speeds.length > 50) speeds.shift();

    const colorClass = lastPacket[0] === 'TCP' ? 'green' : 'red';
    const line = document.createElement('div');
    line.className = `line ${colorClass}`;

    // Updated text content
    line.textContent = `Protocol: ${lastPacket[0]} | SRC: ${lastPacket[1]} | DST: ${lastPacket[2]} | SIZE: ${lastPacket[3]} | SPEED: ${currentSpeed} Mbps`;

    logs.appendChild(line);
    logs.scrollTop = logs.scrollHeight;

    lastPacket = null;
}

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find the highest speed in our array to scale the graph automatically
    const maxSpeed = Math.max(...speeds, 10); // Minimum scale of 10 Mbps

    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    speeds.forEach((val, i) => {
        const x = i * (canvas.width / 50);
        // Scale Y relative to the maxSpeed found
        const y = canvas.height - (val / maxSpeed) * canvas.height;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

setInterval(() => {
    generateLog();
    drawGraph();
}, 1); // Faster refresh for a "live" feel