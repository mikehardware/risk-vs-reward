// Event listener for "Start Playing RISK vs. REWARD" button
document.getElementById('start-game').addEventListener('click', () => {
  const selectedSet = document.getElementById('question-set').value; // Get the selected question set
  localStorage.setItem('selectedSet', selectedSet);  // Store the selected set in localStorage
  window.location.href = 'gameshow.html';  // Redirect to the game page
});

// Event listener for "View the Pitch" button
document.getElementById('view-pitch').addEventListener('click', () => {
  window.location.href = 'pitch.html';  // Navigate to the pitch page
});