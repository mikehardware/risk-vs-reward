const {
  riskInterpolate,
  rewardInterpolate,
  calculateSliderData
} = require('./logic');

const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Risk vs. Reward server is live!');
});

app.use(express.json()); // allows parsing of JSON in POST requests

app.post('/api/slider-data', (req, res) => {
  const { sliderValue, questionIndex, cumulativeSliderTotal, cumulativeBank } = req.body;

  const result = calculateSliderData(
    sliderValue,
    questionIndex,
    cumulativeSliderTotal,
    cumulativeBank
  );

  // Safety check: bail if values are bad
  if (
    result.risk == null || isNaN(result.risk) ||
    result.reward == null || isNaN(result.reward)
  ) {
    console.warn("⚠️ Invalid data returned — something went sideways.");
    return res.status(400).json({ success: false, error: "Invalid calculation result." });
  }

  res.json({
    success: true,
    ...result
  });
});


app.listen(port, () => {
  //console.log(`Server is running at http://localhost:${port}`);
});