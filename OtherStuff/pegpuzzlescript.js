const board = document.getElementById("board");
const message = document.getElementById("message");
const startHoleSelect = document.getElementById("start-hole");

const positions = [
  [175, 0],
  [150, 45], [200, 45],
  [125, 90], [175, 90], [225, 90],
  [100, 135], [150, 135], [200, 135], [250, 135],
  [75, 180], [125, 180], [175, 180], [225, 180], [275, 180]
];

let holes = [];
let selected = null;
let gameOver = false;

const jumps = {
  0: [[1,3], [2,5]],
  1: [[3,6], [4,8]],
  2: [[4,7], [5,9]],
  3: [[1,0], [4,5], [6,10], [7,12]],
  4: [[7,11], [8,13]],
  5: [[2,0], [4,3], [8,12], [9,14]],
  6: [[3,1], [7,8]],
  7: [[4,2], [8,9]],
  8: [[4,1], [7,6]],
  9: [[5,2], [8,7]],
  10: [[6,3], [11,12]],
  11: [[7,4], [12,13]],
  12: [[7,3], [8,5], [11,10], [13,14]],
  13: [[8,4], [12,11]],
  14: [[9,5], [13,12]]
};

function populateDropdown() {
  for (let i = 0; i < 15; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.text = `Hole ${i + 1}`;
    startHoleSelect.appendChild(opt);
  }
}

function createBoard(emptyIndex = 0) {
  board.innerHTML = "";
  holes = [];
  selected = null;
  gameOver = false;
  for (let i = 0; i < 15; i++) {
    const hole = document.createElement("div");
    hole.className = "hole";
    if (i !== emptyIndex) hole.classList.add("peg");
    hole.style.left = positions[i][0] + "px";
    hole.style.top = positions[i][1] + "px";
    hole.dataset.index = i;
    hole.innerText = i + 1;

    hole.addEventListener("click", () => handleClick(i));
    holes.push(hole);
    board.appendChild(hole);
  }

  updateMessage();
}

function handleClick(index) {
  if (gameOver) return;

  clearHighlights();
  if (selected === null) {
    if (holes[index].classList.contains("peg")) {
      selected = index;
      holes[index].classList.add("selected");
      highlightValidMoves(selected);
    }
  } else if (index === selected) {
    holes[selected].classList.remove("selected");
    selected = null;
  } else {
    if (tryJump(selected, index)) {
      selected = null;
      updateMessage();
    } else {
      holes[selected].classList.remove("selected");
      selected = null;
    }
  }
}

function highlightValidMoves(from) {
  const options = jumps[from] || [];
  for (let [over, end] of options) {
    if (
      holes[over].classList.contains("peg") &&
      !holes[end].classList.contains("peg")
    ) {
      holes[end].classList.add("valid-target");
    }
  }
}

function clearHighlights() {
  holes.forEach(h => h.classList.remove("valid-target", "selected"));
}

function tryJump(from, to) {
  if (holes[to].classList.contains("peg")) return false;

  const options = jumps[from] || [];
  for (let [over, end] of options) {
    if (end === to && holes[over].classList.contains("peg")) {
      holes[from].classList.remove("peg");
      holes[over].classList.remove("peg");
      holes[to].classList.add("peg");
      return true;
    }
  }

  return false;
}

function updateMessage() {
  const pegsLeft = holes.filter(h => h.classList.contains("peg")).length;
  let hasMove = false;

  for (let i = 0; i < 15; i++) {
    if (!holes[i].classList.contains("peg")) continue;
    const options = jumps[i] || [];
    for (let [over, end] of options) {
      if (
        holes[over].classList.contains("peg") &&
        !holes[end].classList.contains("peg")
      ) {
        hasMove = true;
      }
    }
  }

  if (!hasMove) {
    message.innerText = pegsLeft === 1
      ? "🎉 You did it—just one peg left!"
      : `Game over. Pegs remaining: ${pegsLeft}`;
    gameOver = true;
  } else {
    message.innerText = `Pegs left: ${pegsLeft}`;
  }
}

function startGame() {
  const emptyIndex = parseInt(startHoleSelect.value);
  createBoard(emptyIndex);
  message.innerText = "";
}

function resetGame() {
  startGame();
}

populateDropdown();
createBoard(0);
