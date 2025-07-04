// logic.js

const minRiskPct = 0.16237;
const maxRiskPct = 0.596298274140;
const maxRewardPct = 0.873817422860;
const minRewardPct = 0.596298274140;

// Add any others needed by rewardInterpolate or calculateSliderData

function riskInterpolate(someNumber, minRiskPct, maxRiskPct, adjustedMinRiskPct) {
  if (someNumber < 0 || someNumber > 1) return 0;

  if (someNumber <= 0.25) {
    return adjustedMinRiskPct + ((someNumber / 0.25) * ((0.37 * maxRiskPct) - adjustedMinRiskPct));
  } else if (someNumber <= 0.50) {
    return (0.37 * maxRiskPct) + ((someNumber - 0.25) / 0.25) * ((0.62 * maxRiskPct) - (0.37 * maxRiskPct));
  } else if (someNumber <= 0.75) {
    return (0.62 * maxRiskPct) + ((someNumber - 0.50) / 0.25) * ((0.87 * maxRiskPct) - (0.62 * maxRiskPct));
  } else {
    return (0.87 * maxRiskPct) + ((someNumber - 0.75) / 0.25) * (maxRiskPct - (0.87 * maxRiskPct));
  }
}

function rewardInterpolate(someNumber, adjustedMaxRewardPct) {
  if (someNumber < 0 || someNumber > 1) return 0;

  if (someNumber <= 0.25) {
    return (someNumber / 0.25) * (0.28 * adjustedMaxRewardPct);
  } else if (someNumber <= 0.50) {
    return (0.28 * adjustedMaxRewardPct) +
      ((someNumber - 0.25) / 0.25) * ((0.49 - 0.28) * adjustedMaxRewardPct);
  } else if (someNumber <= 0.75) {
    return (0.49 * adjustedMaxRewardPct) +
      ((someNumber - 0.50) / 0.25) * ((0.72 - 0.49) * adjustedMaxRewardPct);
  } else {
    return (0.72 * adjustedMaxRewardPct) +
      ((someNumber - 0.75) / 0.25) * ((1 - 0.72) * adjustedMaxRewardPct);
  }
}

function calculateSliderData(sliderValue, currentQuestionIndex, cumulativeSliderTotal, currentBank) {

  const sliderPercent = sliderValue / 30000;
  const remainingQuestions = 11 - currentQuestionIndex;

  const maxRewardPct = 0.873817422860;
  const minRewardPct = 0.596298274140;

  const minRiskPct = 0.16237;
  const maxRiskPct = 0.596298274140;
  const fullRiskFactor = 0.596298274140;

  const sliderPenalty = ((currentQuestionIndex * 30000) - cumulativeSliderTotal) + (30000 - sliderValue);

  const penaltyFactor = ((currentQuestionIndex * 30000) - cumulativeSliderTotal) / 330000;
  const cumulativePenaltyFactor = currentQuestionIndex >= 1 ? penaltyFactor : 0;

  const expectedMinRiskPct = minRiskPct + (penaltyFactor * (maxRiskPct - minRiskPct));
  const expectedMaxRewardPct = maxRewardPct - (penaltyFactor * (maxRewardPct - minRewardPct));

  const adjustedMinRiskPct = expectedMinRiskPct;
  const adjustedMaxRewardPct = expectedMaxRewardPct;

  const interpolatedRiskPct = riskInterpolate(
    sliderPercent,
    minRiskPct,
    maxRiskPct,
    adjustedMinRiskPct
  );

    const interpolatedRewardPct = rewardInterpolate(
    sliderPercent,
    adjustedMaxRewardPct
  );

  const adjustedRiskPct = interpolatedRiskPct * (1 + cumulativePenaltyFactor);
  const adjustedRewardPct = interpolatedRewardPct * (1 - cumulativePenaltyFactor);

  const risk = currentBank * interpolatedRiskPct;
  const reward = currentBank * interpolatedRewardPct;

  const newBankIfWrong = currentBank - risk;
  const newBankIfCorrect = currentBank + reward;

  const originalMaxRewardPct = 0.873817422860;
  const originalMinRewardPct = 0.596298274140;
  const totalPositions = 330000;

  const adjustedRewardForNextQuestion =
    originalMaxRewardPct -
    ((sliderPenalty / totalPositions) *
      (originalMaxRewardPct - originalMinRewardPct));

  const leastIfWrong =
    newBankIfWrong * Math.pow((1 - fullRiskFactor), remainingQuestions);
  const mostIfWrong =
    newBankIfWrong * Math.pow((1 + adjustedRewardForNextQuestion), remainingQuestions);

  const leastIfCorrect =
    newBankIfCorrect * Math.pow((1 - fullRiskFactor), remainingQuestions);
  const mostIfCorrect =
    newBankIfCorrect * Math.pow((1 + adjustedRewardForNextQuestion), remainingQuestions);

    // Optional: include rounded display values for use in UI
  const displayedRisk = Number(risk.toFixed(2));
  const displayedReward = Number(reward.toFixed(2));
  const displayedCurrentBank = Number(currentBank.toFixed(2));
  const displayedNewBankIfWrong = Number(newBankIfWrong.toFixed(2));
  const displayedNewBankIfCorrect = Number(newBankIfCorrect.toFixed(2));

  return {
    sliderPercent,
    interpolatedRiskPct,
    interpolatedRewardPct,
    adjustedMinRiskPct,
    adjustedMaxRewardPct,
    penaltyFactor,
    cumulativePenaltyFactor,
    risk,
    reward,
    newBankIfWrong,
    newBankIfCorrect,
    leastIfWrong,
    mostIfWrong,
    leastIfCorrect,
    mostIfCorrect,
    displayedRisk,
    displayedReward,
    displayedCurrentBank,
    displayedNewBankIfWrong,
    displayedNewBankIfCorrect
  };
}

exports.handler = async function(event) {
  try {
    if (!event.body) {
      console.error("❌ No body received in request");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing request body" })
      };
    }

    const data = JSON.parse(event.body);

    const {
      sliderValue,
      currentQuestionIndex,
      cumulativeSliderTotal,
      currentBank
    } = data;
        const result = calculateSliderData(
      sliderValue,
      currentQuestionIndex,
      cumulativeSliderTotal,
      currentBank
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error("💥 Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};