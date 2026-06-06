
// Resizable side panel
const resizer = document.getElementById('resizer');
const sidePanel = document.getElementById('side-panel');
const PANEL_MIN = 150;
const PANEL_MAX = 600;

resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    resizer.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = sidePanel.offsetWidth;

    function onMove(e) {
        const newWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + (startX - e.clientX)));
        sidePanel.style.width = newWidth + 'px';
        map.invalidateSize();
    }
    function onUp() {
        resizer.classList.remove('dragging');
        resizer.removeEventListener('pointermove', onMove);
        resizer.removeEventListener('pointerup', onUp);
    }
    resizer.addEventListener('pointermove', onMove);
    resizer.addEventListener('pointerup', onUp);
});