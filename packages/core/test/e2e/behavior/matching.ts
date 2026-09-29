const marker = document.querySelector('#script-runs');
if (!marker) throw new Error('Missing script run marker');
marker.textContent = String(Number(marker.textContent) + 1);
