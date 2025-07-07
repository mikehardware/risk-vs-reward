// Define the constants for RISK and REWARD calculations
import throttle from 'https://cdn.skypack.dev/lodash/throttle';
import debounce from 'https://cdn.skypack.dev/lodash/debounce';

const maxRewardPct = 0.873817422860;
const minRewardPct = 0.596298274140;
const originalMaxRewardPct = 0.873817422860;
const originalMinRewardPct = 0.596298274140;
const maxSliderValue = 30000;  // total number of positions on the slider
const totalPositions = 330000; // or 360000, depending on your approach
const minRiskPct = 0.16237;
const maxRiskPct = 0.596298274140;
let adjustedMinRiskPct = minRiskPct; // Adjusted minimum risk percentage
let adjustedMaxRewardPct = maxRewardPct; // Adjusted maximum reward percentage
const rewardDiff = maxRewardPct - minRewardPct;
const riskDiff = maxRiskPct - minRiskPct;
import { questionSets } from '../js/questions.js';

// Global Variables
let questions = []; // This will hold the filtered questions for the game

// Fetch Questions for Selected Set and Category
const selectedSet = localStorage.getItem('selectedSet') || 'set1'; // Default to 'set1'
let selectedCategory = localStorage.getItem('selectedCategory') || ''; // Default empty if not selected
let currentQuestion = null; // Declare globally

// DOM Elements
const categorySelect = document.getElementById("category"); // Uncomment this line

let currentQuestionIndex = 0; // This tracks the index of the current question
let risk;
let reward;
let nextQuestionButton = document.getElementById('next-question');
let startNewGameButton = document.getElementById('begin-new-game');
let currentSet = localStorage.getItem('selectedSet') || 'set1'; // Default to set1 if not found
let doOverUsed = false; // Track if the Do Over button has been used

let newBank = 533.66992312;
let currentBank = 533.66992312;
let sliderPercent;
let isCorrect;
let bgColor;
let previousBankValue;
let newBankIfCorrect;
let newBankIfWrong;
let sliderPenalty = 0;
let initialBackgroundColor = '#87ceeb'; // Default color for the first question
// Track total slider settings across all questions
let cumulativeSliderTotal = 0;
let tempSliderValue = 0;
let cumulativePenaltyFactor = 0.0;
let lockedSliderValue = 0; // Default starting value

// Populate dropdown with categories from the selected question set
const categories = questionSets[selectedSet].categories;
let textColor = "black"; // Set the default color, e.g., "black"

categories.forEach(category => {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  categorySelect.appendChild(option);
});
const questionBox = document.getElementById("question-box");
const questionNumber = document.getElementById("question-number");
const categoryLabel = document.getElementById("category-label");
const questionText = document.getElementById("question-text");
const answers = {
  A: document.getElementById("choiceA"),
  B: document.getElementById("choiceB"),
  C: document.getElementById("choiceC"),
  D: document.getElementById("choiceD"),
};
const riskSlider = document.getElementById("riskSlider");
const sliderRisk = document.getElementById("slider-risk");
const sliderReward = document.getElementById("slider-reward");
const lockButton = document.getElementById("lock-button");  // This targets the Lock in Answer button
const riskDisplay = document.getElementById("slider-risk");
const rewardDisplay = document.getElementById("slider-reward");

const riskCurrent = document.getElementById("risk-current-bank");
const riskMinus = document.getElementById("risk-minus");
const riskNew = document.getElementById("risk-new");
const riskLeast = document.getElementById("risk-least");
const riskMost = document.getElementById("risk-most");

const rewardCurrent = document.getElementById("reward-current-bank");
const rewardPlus = document.getElementById("reward-plus");
const rewardNew = document.getElementById("reward-new");
const rewardLeast = document.getElementById("reward-least");
const rewardMost = document.getElementById("reward-most");

// Declare audio elements (add these at the top)
const tick = document.getElementById('tick');
const buzzer = document.getElementById('buzzer');
const fanfare = document.getElementById('fanfare');

// Set initial background color to match the first question's color (before the first question is displayed)
document.body.className = ''; // Clear existing classes
document.body.classList.add('bg-light-blue', 'text-black'); // Apply initial background and text color
const timerDisplay = document.getElementById("timer");

function triggerConfetti() {
  confetti({
    particleCount: 300,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#ffd700', '#ffffff', '#ff8c00']
  });
}

// Helper function to interpolate between two colors
function interpolateColor(color1, color2, factor) {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;

  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return `rgb(${r}, ${g}, ${b})`;
}

function showCategoryDropdown() {
  const categoryDropdown = document.getElementById('category');
  categoryDropdown.style.visibility = 'visible';
  updateBackgroundColor(currentBank)
}


function hideCategoryDropdown() {
  const categoryDropdown = document.getElementById('category');
  categoryDropdown.style.visibility = 'hidden';
}

function initializeGame() {
  // Hide game elements at the start
  document.getElementById('question-box').style.display = 'none';
  document.getElementById('timer-container').style.display = 'none';
  document.getElementById('risk-column').classList.remove('visible');
  document.getElementById('reward-column').classList.remove('visible');
}

// Function to update the background color smoothly
function updateBackgroundColor(value) {
  // 1) Your color stops
  const colorStops = [
    { value: 0.01, color: "#321525" },
    { value: 0.02, color: "#3E1C3A" },
    { value: 0.06, color: "#5A2E5F" },
    { value: 0.15, color: "#4C2A55" },
    { value: 0.38, color: "#3B234F" },
    { value: 0.93, color: "#291A47" },
    { value: 2.31, color: "#0F1430" },
    { value: 5.72, color: "#121B34" },
    { value: 14.17, color: "#1D2B45" },
    { value: 35.11, color: "#2C3F5A" },
    { value: 86.97, color: "#445C72" },
    { value: 215.44, color: "#5A7380" },
    { value: 533.67, color: "#87CEEB" },
    { value: 1000.00, color: "#A0D8EF" },
    { value: 1873.82, color: "#BFE2EF" },
    { value: 3511.19, color: "#FFEDA0" },
    { value: 6579.33, color: "#FFE070" },
    { value: 12328.47, color: "#FFD140" },
    { value: 23101.30, color: "#FFB200" },
    { value: 43287.61, color: "#FF8C00" },
    { value: 81113.08, color: "#FF6A00" },
    { value: 151991.11, color: "#FF5733" },
    { value: 284803.59, color: "#E03A00" },
    { value: 533669.93, color: "#C00000" }
  ];

  // 2) Round up front so tiny FP errors don’t break your ranges
  const roundedValue = Number(value.toFixed(2));

  // 3) Figure out bgColor
  let bgColor;
  // a) Below the very first stop?
  if (roundedValue < colorStops[0].value) {
    bgColor = colorStops[0].color;
  } else {
    // b) Find the correct segment
    for (let i = 0; i < colorStops.length - 1; i++) {
      const lo = colorStops[i].value;
      const hi = colorStops[i + 1].value;

      if (roundedValue >= lo && roundedValue < hi) {
        // percent between lo and hi
        const pct = (roundedValue - lo) / (hi - lo);
        bgColor = interpolateColor(
          colorStops[i].color,
          colorStops[i + 1].color,
          pct
        );
        break;
      }
    }
  }

  // 4) If you’re at-or-above the last stop, use the image and bail
  const topStop = colorStops[colorStops.length - 1];
  if (roundedValue >= topStop.value) {
    document.body.style.backgroundImage = 'url("images/empty-save-texture-room-light.jpg")';
    document.body.style.color = "#000";
    return;
  }

  // 5) Fallback to first stop if somehow unset
  bgColor = bgColor || colorStops[0].color;

  // 6) Apply your background
  document.body.style.backgroundImage = "";
  document.body.style.backgroundColor = bgColor;

  // 7) Extract RGB once and compute brightness
  //    ‑- we know bgColor is "#rrggbb"
  const [r, g, b] = bgColor
    .match(/\d+/g)
    .map((n) => parseInt(n, 10));
  const brightness = r + g + b;
  textColor = brightness > 400 ? "#000" : "#fff";

  // 8) Paint text/UI elements
  document.body.style.color = textColor;
  const questionBox = document.getElementById("question-box");
  if (questionBox) {
    questionBox.style.color = textColor;
  }

  const timer = document.getElementById("timer-container");
  if (timer) {
    timer.style.color = textColor;
  }

  const rrCols = document.getElementById("risk-reward-columns");
  if (rrCols) {
    rrCols.style.color = "black";
  }

  const riskCol = document.getElementById("risk-column");
  if (riskCol) {
    riskCol.style.backgroundColor = "lightcoral";
  }

  const rewardCol = document.getElementById("reward-column");
  if (rewardCol) {
    rewardCol.style.backgroundColor = "lightgreen";
  }
}


// Add event listeners to enable the button when an answer is chosen
document.querySelectorAll("input[name='answer']").forEach((radio) => {
  radio.addEventListener("change", () => {
    document.getElementById("lock-button").disabled = false;
  });
});

function initializeSliderValues() {
  const sliderValue = Number(riskSlider.value); // Ensures it’s always a number risk = (sliderValue / 100) * maxRiskPct;
  reward = (sliderValue / 100) * maxRewardPct;

  // Update the RISK and REWARD displays
  riskDisplay.textContent = risk.toFixed(2);
  rewardDisplay.textContent = reward.toFixed(2);
}

// Declare timer variables at the top of your JavaScript
let timeLeft = 120;  // Time limit for each question (set to 120 seconds initially)
let countdown;  // Interval to hold the countdown

// Enable the "Do Over" button if the player can use it
function enableDoOver(isCorrect, currentQuestionIndex) {
  const doOverButton = document.getElementById('do-over-button');
  // recompute sliderPercent on each call:
  const sliderPercent = Number(
    document.getElementById('riskSlider').value
  ) / 30000;

  const shouldShow =
    currentQuestionIndex < 6 &&
    !doOverUsed &&
    (sliderPercent !== 1 || !isCorrect);

  doOverButton.style.display = shouldShow ? 'block' : 'none';
}

function showTimer() {
  const timerContainer = document.getElementById("timer-container");

  // Remove the 'hidden' class to make the timer visible
  timerContainer.classList.remove("hidden");
}

function disableNextQuestionButton() {
  const nextQuestionButton = document.getElementById('next-question');
  nextQuestionButton.disabled = true; // Disable the button
  nextQuestionButton.style.display = 'none'; // Hide it, if needed
}

// Helper Function for Getting Questions by Category
function getQuestionsByCategory(category, setNumber) {
  const questions = getQuestionsBySet(setNumber);

  const filtered = questions.filter(question => question.category.toLowerCase() === category.toLowerCase());

  return filtered;
}

// Helper Function for Getting Questions by Set
function getQuestionsBySet(setNumber) {
  return questionSets[setNumber]?.questions || [];
}

function removeUsedCategory(category) {
  const categoryDropdown = document.getElementById("category"); // Target the <select> element
  const options = Array.from(categoryDropdown.options);

  options.forEach(option => {
    if (option.value === category) {
      categoryDropdown.removeChild(option); // Remove the category from dropdown
    }
  });

}

function handleTimeUp() {
  // Simulate clicking the "Lock in Answer" button
  document.getElementById("lock-button").disabled = false; // Ensure the button is active before triggering click
  document.getElementById("lock-button").click();
}

// Helper function to reset and start the timer
function resetAndStartTimer() {


  // Declare and initialize timerContainer first
  const timerContainer = document.getElementById("timer-container");
  timerContainer.style.display = 'block'; // Make the timer container visible

  timerDisplay.style.display = 'inline'; // Ensure timer text is visible
  timerContainer.style.color = textColor; // Match timer's text color

  timeLeft = 120; // Reset the time for each new question
  timerDisplay.textContent = `Countdown: ${timeLeft}`;

  // Clear the previous countdown (if any) and stop the ticking sound
  clearInterval(countdown);
  tick.pause();
  tick.currentTime = 0;

  // Start a new countdown for the current question
  countdown = setInterval(() => {
    timeLeft--; // Decrease the time
    timerDisplay.textContent = `Countdown: ${timeLeft}`; // Update the display

    // Trigger ticking sound at 30 seconds and 10 seconds
    if (timeLeft === 30) {
      tick.volume = 0.3;
      tick.loop = true;
      tick.play().catch(() => { });
    } else if (timeLeft === 10) {
      tick.volume = 0.7;
    } else if (timeLeft === 0) {
      // When time runs out, stop the timer and play buzzer
      clearInterval(countdown);
      timerDisplay.textContent = "TIME'S UP!";
      tick.pause();
      tick.currentTime = 0;
      buzzer.play(); // Play buzzer sound
      handleTimeUp(); // Handle logic when time is up (e.g., mark as incorrect)
    }
  }, 1000); // Update every second
}

// Inside loadQuestion()
function loadQuestion() {
  // Hide the "Use the Do Over" button at the start of each new question
  const doOverButton = document.getElementById('do-over-button');
  doOverButton.style.display = 'none';
  document.getElementById("result-box").classList.remove("hidden");

  if (!selectedCategory) {
    console.error("No category selected!");
    return;
  }

  tempSliderValue = 0;  // Reset when a new question starts
  previousBankValue = currentBank;
  updateBackgroundColor(currentBank); // Update the background color based on the current bank value

  const questionNumberElement = document.getElementById('question-number'); // Assuming you have this element
  questionNumberElement.textContent = `Question: ${currentQuestionIndex + 1}`;
  const answerButtons = document.querySelectorAll('.answer-button'); // Adjust selector as needed
  answerButtons.forEach(button => {
    button.disabled = false; // Re-enable buttons
    button.classList.remove('selected'); // Remove previous selection styles
  });

  const radioInputs = document.querySelectorAll('#answers input[type="radio"]');
  radioInputs.forEach(input => {
    input.checked = false; // Clear selection
    input.disabled = false; // Enable answer radio buttons for interaction
  });
  document.getElementById('riskSlider').value = 0;  // Set slider to far-left position (0)

  const selectedSet = localStorage.getItem('selectedSet') || 'set1'; // Fallback to 'set1' if not found

  // Retrieve questions for the selected category
  const categoryQuestions = getQuestionsByCategory(selectedCategory, selectedSet);

  // Remove the first question from the filtered list
  currentQuestion = categoryQuestions.shift();

  disableNextQuestionButton();

  // Show both columns initially
  document.getElementById('risk-column').classList.add('visible'); // Show "If you miss..." column
  document.getElementById('reward-column').classList.add('visible'); // Show "If you are correct..." column  

  // Retrieve DOM elements
  const questionTextElement = document.getElementById('question-text');
  const choiceAElement = document.getElementById('choiceA');
  const choiceBElement = document.getElementById('choiceB');
  const choiceCElement = document.getElementById('choiceC');
  const choiceDElement = document.getElementById('choiceD');
  const categoryLabelElement = document.getElementById('category-label');

  // Ensure all DOM elements exist
  if (!questionTextElement || !choiceAElement || !choiceBElement || !choiceCElement || !choiceDElement || !questionBox || !categoryLabelElement) {
    console.error("One or more question/answer elements are missing!");
    return; // Exit early
  }

  // Update UI with the current question and answers
  questionTextElement.textContent = currentQuestion.question;
  choiceAElement.textContent = currentQuestion.answers.A;
  choiceBElement.textContent = currentQuestion.answers.B;
  choiceCElement.textContent = currentQuestion.answers.C;
  choiceDElement.textContent = currentQuestion.answers.D;

  // Update category label
  categoryLabelElement.textContent = `Category: ${selectedCategory}`;

  // Make question box visible
  questionBox.classList.remove('hidden');
  // Initialize slider values and enable "Lock in Answer" button
  updateSliderValues(0);
  // Re-enable the slider for user interaction
  riskSlider.disabled = false;

  lockButton.disabled = true; // Disable the button until an answer is selected 

  // Remove the selected category from the Select Category pulldown
  removeUsedCategory(selectedCategory);
  // Hide the category dropdown once a category is selected
  hideCategoryDropdown();

  // Reset and start the timer
  resetAndStartTimer();
}

function resetForDoOver() {
  // Reset the bank value to the state before answering the question
  newBank = previousBankValue;  // previousBankValue stored when the question is first shown
  currentBank = previousBankValue;  // Reset currentBank to previousBankValue
  cumulativeSliderTotal = cumulativeSliderTotal - tempSliderValue;  // Adjust cumulative total 
  doOverUsed = true;

  // Reset the slider to the default position (min position, which is 0)
  document.getElementById('riskSlider').value = 0;  // Set slider to far-left position (0)

  // Reset the displayed slider values (RISK and REWARD)
  document.getElementById('slider-risk').textContent = "–$0.00";  // Default RISK value (min RISK)
  document.getElementById('slider-reward').textContent = "REWARD $0.00";  // Default REWARD value (min REWARD)

  // Unselect the answer options
  document.querySelectorAll('input[name="answer"]').forEach((radio) => {
    radio.checked = false;
    radio.disabled = false;  // Enable answer radio buttons again
  });

  // Hide the "Do Over" button after it's used
  document.getElementById('do-over-button').style.display = 'none';

  // Reset the timer and the question to the state before it was answered
  timeLeft = 120;  // Reset the timer to 120 seconds
  timerDisplay.textContent = `Countdown: ${timeLeft}`;
  clearInterval(countdown);  // Clear the previous countdown

  // Reset text for the next question
  document.getElementById('risk-column').querySelector('h3').textContent = "If you miss...";  // Reset to original
  document.getElementById('reward-column').querySelector('h3').textContent = "If you are correct...";  // Reset to original

  // THIS WOULD NEED TO GO BACK AND SELECT A CATEGORY
  showCategoryDropdown();  // Show the category dropdown again
  initializeGame();  // Reinitialize the game state

}

document.addEventListener("DOMContentLoaded", () => {

  initializeGame()
  // Initialize currentQuestionIndex to 0 (starting with the first question)
  const selectedSet = localStorage.getItem('selectedSet') || 'set1';
  const categories = questionSets[selectedSet].categories;
  const categorySelect = document.getElementById("category");
  document.body.className = ''; // Clear existing classes
  document.body.classList.add('bg-light-blue', 'text-black'); // Set the starting background and text color
  //}
  // Retrieve the selected set from localStorage (default to 'set1' if not found)

  // Get the selected set of questions
  questions = questionSets[selectedSet].questions;

  // Clear the existing options in case the dropdown is populated
  categorySelect.innerHTML = "";

  // Add a default option to the dropdown
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select a Category --";
  categorySelect.appendChild(defaultOption);

  // Populate the category dropdown with the categories of the selected set
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });


  // Event listener for the category selection
  categorySelect.addEventListener("change", () => {
    selectedCategory = categorySelect.value; // Capture dropdown selection

    if (!selectedCategory) {
      console.error("Category selection is empty!");
      return;
    }

    // Save the selected category to localStorage for persistence
    localStorage.setItem('selectedCategory', selectedCategory);

    // Reset game states if needed (uncomment these lines if you want to reset gameplay)
    // Reset text for the next question
    document.getElementById('risk-column').querySelector('h3').textContent = "If you miss...";  // Reset to original
    document.getElementById('reward-column').querySelector('h3').textContent = "If you are correct...";  // Reset to original

    // **Show game elements after category selection**
    document.getElementById('question-box').style.display = 'block'; // Make the question box visible
    document.getElementById('timer-container').style.display = 'block'; // Show the timer
    document.getElementById('risk-column').classList.add('visible'); // Default to showing "If you miss..." box
    document.getElementById('reward-column').classList.remove('visible'); // Ensure "If you are correct..." box is hidden

    // Load the first question for the newly selected category
    loadQuestion();
  });
});


// Function to show the next question button
function enableNextQuestionButton() {
  nextQuestionButton = document.getElementById('next-question');
  startNewGameButton = document.getElementById('begin-new-game');
  nextQuestionButton.disabled = false;

  // Show the "Go to the Next Question" or "Start New Game" button based on the question index
  if (currentQuestionIndex >= 11) {
    nextQuestionButton.style.display = 'none';
    startNewGameButton.style.display = 'block';  // Show the "Start New Game" button
  } else {
    nextQuestionButton.style.display = 'block';  // Show the "Go to the Next Question" button
    startNewGameButton.style.display = 'none';
  }

}

// This function is called when the "Lock in Answer" button is clicked
lockButton.addEventListener("click", async () => {
  const slider = document.getElementById("riskSlider");
  const lockedV = Number(slider.value);
  lockButton.disabled = true;

  try {
    // Call your backend to get the calculations
    const response = await fetch("/.netlify/functions/calculateSliderData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sliderValue: lockedV,
        currentQuestionIndex,
        cumulativeSliderTotal,
        currentBank
      })
    });

    if (!response.ok) throw new Error("Function call failed");

    const {
      risk: theRisk,
      reward: theReward,
      displayedRisk,
      displayedReward,
      newBankIfCorrect,
      newBankIfWrong,
      leastIfCorrect,
      mostIfCorrect,
      leastIfWrong,
      mostIfWrong
    } = await response.json();

    const selected = document.querySelector('input[name="answer"]:checked');
    const isCorrect = selected?.value === currentQuestion.correct;
    const newBank = isCorrect
      ? currentBank + theReward
      : currentBank - theRisk;

    // Update global game state
    currentBank = newBank;
    cumulativeSliderTotal += lockedV;
    tempSliderValue = lockedV;  // Store the current slider value for potential Do Over

    // Shut down inputs and timers
    clearInterval(countdown);
    tick.pause(); tick.currentTime = 0;
    lockButton.disabled = true;
    slider.disabled = true;
    document.querySelectorAll('input[name="answer"]').forEach(i => i.disabled = true);

    updateBackgroundColor(currentBank);

function fmtMoney(num) {
  const rounded = Math.round((+num + Number.EPSILON) * 100) / 100;
  return rounded.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

    if (currentQuestionIndex + 1 === 12) {
      const rewardLeastLabel = rewardLeast?.parentElement?.querySelector('.label');
      const riskLeastLabel = riskLeast?.parentElement?.querySelector('.label');
      if (rewardLeastLabel) rewardLeastLabel.textContent = "You Won:";
      if (riskLeastLabel) riskLeastLabel.textContent = "You Won:";
    }

    // Populate the result panel
    if (isCorrect) {
      document.getElementById("reward-column").classList.add("visible");
      document.getElementById("risk-column").classList.remove("visible");
      document.getElementById("reward-current-bank").textContent = fmtMoney(currentBank);   //LINE 660
      document.getElementById("reward-plus").textContent = fmtMoney(displayedReward);
      document.getElementById("reward-new").textContent = fmtMoney(newBankIfCorrect);
      document.getElementById("reward-least").textContent = fmtMoney(leastIfCorrect);
      document.getElementById("reward-most").textContent = fmtMoney(mostIfCorrect);
      document.querySelector("#reward-column h3").textContent = "You’re right!";
      if (newBank >= 1_000_000 - 0.005) {
        fanfare.play();
        triggerConfetti();
      }
    } else {
      document.getElementById("risk-column").classList.add("visible");
      document.getElementById("reward-column").classList.remove("visible");
      document.getElementById("risk-current-bank").textContent = fmtMoney(currentBank);
      document.getElementById("risk-minus").textContent = fmtMoney(displayedRisk);
      document.getElementById("risk-new").textContent = fmtMoney(newBankIfWrong);
      document.getElementById("risk-least").textContent = fmtMoney(leastIfWrong);
      document.getElementById("risk-most").textContent = fmtMoney(mostIfWrong);
      document.querySelector("#risk-column h3").textContent = "You missed…";
    }

    enableDoOver(isCorrect, currentQuestionIndex);
    enableNextQuestionButton();
  } catch (err) {
    console.error("❌ Lock-in failed:", err);
    // Optionally show a toast or error message to the player
  }
});

// Function to display the "Go to Next Question" or "Start New Game" button
function showNextButton() {

  // Update and display the correct message in the "If you are correct..." and "If you miss..." boxes
  if (currentQuestionIndex >= questions.length) {
    nextQuestionButton.style.display = 'none';
    startNewGameButton.style.display = 'block';
  } else {
    nextQuestionButton.style.display = 'block';
    startNewGameButton.style.display = 'none';
  }
}

// Event listener for the "Go to the Next Question" button
document.getElementById('next-question').addEventListener('click', () => {
  currentQuestionIndex++;
  // Reset text for the next question
  document.getElementById('risk-column').querySelector('h3').textContent = "If you miss...";  // Reset to original
  document.getElementById('reward-column').querySelector('h3').textContent = "If you are correct...";  // Reset to original
  showCategoryDropdown();  // Show the category dropdown again
  initializeGame();

});

// Event listener for the "Start New Game" button
document.getElementById('begin-new-game').addEventListener('click', () => {
  window.location.href = 'game.html';  // Navigate back to the instructions page
  // Reset the game to the initial state for a new game
  currentQuestionIndex = 0;
  // Reset text for the next question
  document.getElementById('risk-column').querySelector('h3').textContent = "If you miss...";  // Reset to original
  document.getElementById('reward-column').querySelector('h3').textContent = "If you are correct...";  // Reset to original
});

// Event listener for the "Do Over" button
document.getElementById('do-over-button').addEventListener('click', () => {
  // Reset the current question and bank to the state before the question was answered
  resetForDoOver();
});

document.addEventListener("DOMContentLoaded", () => {
  // 1) A small helper that always expects a Number
  function handleSliderValue(val) {
    updateSliderValues(val);
  }

  // 2) Build your throttle/debounce wrappers *here*, using that helper
  const throttledUpdateSliderValues = throttle(handleSliderValue, 250);
  const debouncedUpdateSliderValues = debounce(handleSliderValue, 250);

  // 3) Wire up *one* input listener that extracts the numeric value
  const riskSlider = document.getElementById("riskSlider");
  riskSlider.addEventListener("input", (e) => {
    const num = Number(e.target.value);
    // always pass a Number to your logic—never the Event itself
    throttledUpdateSliderValues(num);
    debouncedUpdateSliderValues(num);
  });

  // … any other one‐time setup you have …
});

// FROM HERE

async function updateSliderValues(sliderValue) {
  try {
    const response = await fetch("/.netlify/functions/calculateSliderData", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sliderValue,
        currentQuestionIndex,
        cumulativeSliderTotal,
        currentBank
      })
    });

    if (!response.ok) throw new Error("Function call failed");

    const sliderData = await response.json();

    const displayedRisk = Number(sliderData.risk.toFixed(2));    //LINE 770
    const displayedReward = Number(sliderData.reward.toFixed(2));
    const displayedCurrentBank = Number(currentBank.toFixed(2));
    const displayedNewBankIfWrong = Number(sliderData.newBankIfWrong.toFixed(2));
    const displayedNewBankIfCorrect = Number(sliderData.newBankIfCorrect.toFixed(2));
    const displayedBankAfterRisk = Number((displayedCurrentBank - displayedRisk).toFixed(2));
    const displayedBankAfterReward = Number((displayedCurrentBank + displayedReward).toFixed(2));


    let correctedRisk = displayedRisk;
    let correctedReward = displayedReward;

    if (displayedBankAfterRisk > displayedNewBankIfWrong) correctedRisk += 0.01;
    else if (displayedBankAfterRisk < displayedNewBankIfWrong) correctedRisk -= 0.01;

    if (displayedBankAfterReward > displayedNewBankIfCorrect) correctedReward -= 0.01;
    else if (displayedBankAfterReward < displayedNewBankIfCorrect) correctedReward += 0.01;

    document.getElementById('slider-risk').textContent = correctedRisk.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  });
    document.getElementById('risk-minus').textContent = `$${correctedRisk.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;

    document.getElementById('slider-reward').textContent = correctedReward.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  });
    document.getElementById('reward-plus').textContent = `$${correctedReward.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;

    document.getElementById('risk-current-bank').textContent = `$${displayedCurrentBank.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    document.getElementById('reward-current-bank').textContent = `$${displayedCurrentBank.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    document.getElementById('risk-new').textContent = `$${sliderData.newBankIfWrong.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    document.getElementById('reward-new').textContent = `$${sliderData.newBankIfCorrect.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;

    const riskLeast = document.getElementById('risk-least');
    const rewardLeast = document.getElementById('reward-least');
    const riskMost = document.getElementById('risk-most');
    const rewardMost = document.getElementById('reward-most');

    riskLeast.textContent = `$${sliderData.leastIfWrong.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    rewardLeast.textContent = `$${sliderData.leastIfCorrect.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    riskMost.textContent = `$${sliderData.mostIfWrong.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;
    rewardMost.textContent = `$${sliderData.mostIfCorrect.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`;

    if (currentQuestionIndex + 1 === 12) {
      const rewardLeastLabel = rewardLeast?.parentElement?.querySelector('.label');
      const riskLeastLabel = riskLeast?.parentElement?.querySelector('.label');
      if (rewardLeastLabel) rewardLeastLabel.textContent = "You Would Win:";
      if (riskLeastLabel) riskLeastLabel.textContent = "You Would Win:";

      if (riskMost) riskMost.style.display = "none";
      if (rewardMost) rewardMost.style.display = "none";

      const riskMostP = document.getElementById("risk-most")?.closest("p");
      if (riskMostP) riskMostP.style.display = "none";
      const rewardMostP = document.getElementById("reward-most")?.closest("p");
      if (rewardMostP) rewardMostP.style.display = "none";
    } else {
      const rewardLeastLabel = rewardLeast?.parentElement?.querySelector('.label');
      const riskLeastLabel = riskLeast?.parentElement?.querySelector('.label');

      if (rewardLeastLabel) rewardLeastLabel.textContent = "The Least You Can Win:";
      if (riskLeastLabel) riskLeastLabel.textContent = "The Least You Can Win:";
      if (rewardMost && riskMost) {
        rewardMost.style.display = "block";
        riskMost.style.display = "block";
      }
    }

  } catch (err) {
    console.error("❌ Error fetching slider data:", err);   // LINE 835
    // Optional: Show an error message on screen
  }
}