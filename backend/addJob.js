fetch('http://localhost:5000/api/jobs', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        title: "UPPSC RO/ARO Recruitment 2026",
        department: "Uttar Pradesh Public Service Commission (UPPSC)",
        location: "Uttar Pradesh",
        qualification: "Bachelor's Degree from a recognized university",
        salary: "₹44,900 - ₹1,42,400 (Level 7)",
        lastDate: "2026-11-15",
        applyLink: "https://uppsc.up.nic.in"
    })
})
.then(res => res.json())
.then(data => console.log("Result:", data))
.catch(err => console.error("Error:", err));