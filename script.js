const WARDS_BY_CIRCLE_FILE = 'wards_by_circle.txt';
const ALLOWED_SUBTYPES = [
    'Illegal Dumping of C&D waste',
    'Waste Not Collected',
    'Dhalao Not Clear',
    'Service Not Available'
];

const SUBTYPE_COLORS = {
    'Illegal Dumping of C&D waste': '#FF6347',  // Tomato
    'Waste Not Collected': '#4682B4',          // Steel Blue
    'Dhalao Not Clear': '#32CD32',             // Lime Green
    'Service Not Available': '#FFD700'         // Gold
};

let complaintData = [];
let wardsByCircle = {};

document.addEventListener('DOMContentLoaded', async () => {
    await loadWardsData(); // Load wards data once
    populateCircleFilter();
    populateWardFilter(); // Populate ward filter after circles
    // Initial render might be empty until a file is uploaded or default data is loaded
    renderReport(); 

    document.getElementById('circle-select').addEventListener('change', renderReport);
    document.getElementById('ward-select').addEventListener('change', renderReport); // Add event listener for ward select
    document.getElementById('csv-upload').addEventListener('change', handleFileUpload);
    document.getElementById('print-report-btn').addEventListener('click', () => {
        const selectedCircle = document.getElementById('circle-select').value;
        if (selectedCircle !== 'all') {
            // Hide all circle sections except the selected one
            document.querySelectorAll('.circle-section').forEach(section => {
                if (!section.querySelector('h2').textContent.includes(selectedCircle)) {
                    section.classList.add('hide-for-print');
                }
            });
        }
        window.print();
        // Show all circle sections again after printing
        document.querySelectorAll('.circle-section').forEach(section => {
            section.classList.remove('hide-for-print');
        });
    });

    document.getElementById('export-jpeg-btn').addEventListener('click', async () => {
        const reportContainer = document.getElementById('report-container');
        // Temporarily hide elements that should not be in the screenshot
        document.querySelector('.control-panel').classList.add('hide-for-print');

        try {
            const canvas = await html2canvas(reportContainer, {
                scale: 2, // Increase scale for higher quality
                useCORS: true, // Enable cross-origin images if any
                logging: false // Disable logging for cleaner console
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.9); // 0.9 for high quality JPEG
            const link = document.createElement('a');
            link.download = 'C&D_Waste_Report.jpeg';
            link.href = imgData;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error exporting JPEG:', error);
            alert('Failed to export report as JPEG. Please try again.');
        } finally {
            // Show hidden elements again
            document.querySelector('.control-panel').classList.remove('hide-for-print');
        }
    });
});

async function loadWardsData() {
    const wardsResponse = await fetch(WARDS_BY_CIRCLE_FILE);
    const wardsText = await wardsResponse.text();
    wardsByCircle = parseWardsByCircle(wardsText);
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const csvText = e.target.result;
            complaintData = parseCSV(csvText);
            renderReport();
            document.querySelector('.upload-section').style.display = 'none'; // Hide the entire upload section after upload
        };
        reader.readAsText(file);
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = [];
        let inQuote = false;
        let currentValue = '';
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim()); // Add the last value

        if (values.length === headers.length) {
            const row = {};
            for (let k = 0; k < headers.length; k++) {
                row[headers[k]] = values[k];
            }
            data.push(row);
        }
    }
    return data;
}

function parseWardsByCircle(text) {
    const circles = {};
    let currentCircle = '';

    text.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.endsWith('Circle Wards:')) {
            currentCircle = line.replace(' Circle Wards:', '');
            circles[currentCircle] = [];
        } else if (line.startsWith('- ') && currentCircle) {
            const wardInfo = line.replace('- ', '').trim();
            const match = wardInfo.match(/^(\d+)-(.+)$/);
            if (match) {
                const wardNumber = match[1];
                circles[currentCircle].push(wardNumber);
            }
        }
    });
    return circles;
}

function populateCircleFilter() {
    const select = document.getElementById('circle-select');
    for (const circleName in wardsByCircle) {
        const option = document.createElement('option');
        option.value = circleName;
        option.textContent = circleName;
        select.appendChild(option);
    }
}

function populateWardFilter() {
    const select = document.getElementById('ward-select');
    const allWards = new Set();
    for (const circleName in wardsByCircle) {
        wardsByCircle[circleName].forEach(ward => allWards.add(ward));
    }
    Array.from(allWards).sort((a, b) => parseInt(a) - parseInt(b)).forEach(ward => {
        const option = document.createElement('option');
        option.value = ward;
        option.textContent = `Ward ${ward}`;
        select.appendChild(option);
    });
}

function renderReport() {
    const selectedCircle = document.getElementById('circle-select').value;
    const selectedWard = document.getElementById('ward-select').value; // Get selected ward
    const reportContainer = document.getElementById('report-container');
    const totalComplaintsCountElement = document.getElementById('total-complaints-count');
    reportContainer.innerHTML = '';

    let overallComplaintCount = 0;
    let circlesToRender = {};
    if (selectedCircle === 'all') {
        circlesToRender = wardsByCircle;
    } else {
        circlesToRender[selectedCircle] = wardsByCircle[selectedCircle];
    }

    for (const circleName in circlesToRender) {
        const circleWards = circlesToRender[circleName];
        const circleData = complaintData.filter(complaint => {
            const wardNumber = complaint['Ward'] ? complaint['Ward'].split('-')[0] : '';
            const isWardMatch = selectedWard === 'all' || wardNumber === selectedWard; // Check if ward matches
            return circleWards.includes(wardNumber) && ALLOWED_SUBTYPES.includes(complaint['complaintsubtype']) && isWardMatch;
        });

        const circleSection = document.createElement('div');
        circleSection.classList.add('circle-section');
        reportContainer.appendChild(circleSection);

        const h2 = document.createElement('h2');
        h2.textContent = `${circleName} Circle Complaints`;
        circleSection.appendChild(h2);

        if (circleData.length > 0) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');

            const headers = ['Sr No', 'Ward', 'Status', 'Complainttype', 'complaintsubtype', 'Complaint Registered Date', 'Complaint Detail'];
            const headerRow = document.createElement('tr');
            headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            circleData.forEach(row => {
                const tr = document.createElement('tr');
                headers.forEach(header => {
                    const td = document.createElement('td');
                    if (header === 'Complaint Registered Date' && row[header]) {
                        const date = new Date(row[header]);
                        td.textContent = date.toLocaleDateString(); // Format to show only the date
                    } else {
                        td.textContent = row[header] || '';
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            circleSection.appendChild(table);

            // Calculate and display total complaint type counts
            const totalComplaintCounts = {};
            ALLOWED_SUBTYPES.forEach(subtype => {
                totalComplaintCounts[subtype] = 0; // Initialize counts
            });

            circleData.forEach(complaint => {
                const subtype = complaint['complaintsubtype'];
                if (ALLOWED_SUBTYPES.includes(subtype)) {
                    totalComplaintCounts[subtype]++;
                }
            });

            const countsDiv = document.createElement('div');
            countsDiv.classList.add('complaint-counts-by-date');
            countsDiv.innerHTML = '<h3>Total Complaint Counts by Type:</h3>'; // Updated heading

            const countsTable = document.createElement('table');
            const countsThead = document.createElement('thead');
            const countsTbody = document.createElement('tbody');

            const countsHeaders = [...ALLOWED_SUBTYPES];
            const countsHeaderRow = document.createElement('tr');
            countsHeaders.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                countsHeaderRow.appendChild(th);
            });
            countsThead.appendChild(countsHeaderRow);
            countsTable.appendChild(countsThead);

            // Single row for total counts
            const tr = document.createElement('tr');
            ALLOWED_SUBTYPES.forEach(subtype => {
                const td = document.createElement('td');
                td.textContent = totalComplaintCounts[subtype] || 0;
                td.style.backgroundColor = SUBTYPE_COLORS[subtype];
                td.style.color = '#FFFFFF';  // White text for visibility
                tr.appendChild(td);
            });
            countsTbody.appendChild(tr);
            countsTable.appendChild(countsTbody);
            countsDiv.appendChild(countsTable);
            circleSection.appendChild(countsDiv);
            const circleTotalComplaints = document.createElement('p');
            circleTotalComplaints.classList.add('circle-total');
            circleTotalComplaints.textContent = `Total Complaints for ${circleName}: ${circleData.length}`;
            circleSection.appendChild(circleTotalComplaints);

            overallComplaintCount += circleData.length;
        } else {
            const noData = document.createElement('p');
            noData.classList.add('no-data');
            noData.textContent = `No relevant complaints found for ${circleName} Circle with the specified subtypes and ward.`;
            circleSection.appendChild(noData);
        }
    }
    totalComplaintsCountElement.textContent = overallComplaintCount;
}