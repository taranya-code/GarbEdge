const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const imageThumb = document.getElementById("imageThumb");
const imageName = document.getElementById("imageName");
const imageMeta = document.getElementById("imageMeta");

const analyseBtn = document.getElementById("analyseBtn");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

const outCategory = document.getElementById("outCategory");
const outVolume = document.getElementById("outVolume");
const outColour = document.getElementById("outColour");
const outScore = document.getElementById("outScore");
const outJustification = document.getElementById("outJustification");
const severityLabel = document.getElementById("severityLabel");
const scoreCircle = document.getElementById("scoreCircle");

const actionBadge = document.getElementById("actionBadge");
const moderateBadge = document.getElementById("moderateBadge");
const lowBadge = document.getElementById("lowBadge");
const hazardPill = document.getElementById("hazardPill");

// Preview image
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  imageName.textContent = file.name;
  imageMeta.textContent = "Image loaded · Ready for analysis";

  const reader = new FileReader();
  reader.onload = (event) => {
    imageThumb.style.backgroundImage = `url('${event.target.result}')`;
  };
  reader.readAsDataURL(file);

  imagePreview.style.display = "flex";

  statusDot.classList.remove("green-status", "yellow-status", "red-status");
  statusText.textContent = "Image loaded · Click scan to analyse";
});

// Utility: clamp score 1-10
function clampScore(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

// Simple pseudo-analysis of image using canvas
async function analyseImageFile(file) {
  const img = new Image();
  img.crossOrigin = "anonymous";

  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  img.src = dataUrl;

  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxDim = 512;
  let { width, height } = img;
  const ratio = Math.min(maxDim / width, maxDim / height, 1);
  width = Math.floor(width * ratio);
  height = Math.floor(height * ratio);

  canvas.width = width;
  canvas.height = height;

  ctx.drawImage(img, 0, 0, width, height);

  const totalPixels = width * height;

  // Sample some pixels randomly to estimate "messiness" / darkness
  const samples = 1000;
  let brightnessSum = 0;
  let darkPixelCount = 0;

  for (let i = 0; i < samples; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const { data } = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = data;
    const brightness = (r + g + b) / 3;
    brightnessSum += brightness;
    if (brightness < 80) darkPixelCount++;
  }

  const avgBrightness = brightnessSum / samples;
  const darkRatio = darkPixelCount / samples;

  // Heuristic rules:
  // - Very large images + high darkRatio -> severe (red)
  // - Medium + moderate darkRatio -> moderate (yellow)
  // - Small/bright -> low (green)

  let severityScore;
  let severityBand;
  let volume;
  let categoryGuess;

  if (totalPixels > 400000 && darkRatio > 0.4) {
    severityScore = 9;
    severityBand = "red";
    volume = "Large/Truck-sized";
  } else if (totalPixels > 200000 && darkRatio > 0.25) {
    severityScore = 7;
    severityBand = "yellow";
    volume = "Medium/Cart-sized";
  } else {
    severityScore = 4;
    severityBand = "green";
    volume = "Small/Bag-sized";
  }

  // Very rough category guess based on brightness
  if (avgBrightness > 180) {
    categoryGuess = "Mixed (Plastic, Packaging, Litter)";
  } else if (avgBrightness > 120) {
    categoryGuess = "Mixed (Household, Organic)";
  } else {
    categoryGuess = "Mixed (Household, Construction)";
  }

  return {
    severityScore,
    severityBand,
    volume,
    categoryGuess,
    metrics: {
      avgBrightness: Math.round(avgBrightness),
      darkRatio: darkRatio.toFixed(2),
      totalPixels
    }
  };
}

function applySeverityToUI(result) {
  const { severityScore, severityBand, volume, categoryGuess, metrics } = result;

  const score = clampScore(severityScore);
  outScore.textContent = score + "/10";

  // Reset circle classes
  scoreCircle.classList.remove("green-severity", "yellow-severity", "red-severity");
  statusDot.classList.remove("green-status", "yellow-status", "red-status");

  let labelText;
  let colourText;

  if (severityBand === "red") {
    scoreCircle.classList.add("red-severity");
    statusDot.classList.add("red-status");
    labelText = "Critical dump – urgent response";
    colourText = "Red (Critical)";
    actionBadge.style.display = "inline-flex";
    moderateBadge.style.display = "none";
    lowBadge.style.display = "none";
    hazardPill.style.display = "inline-flex";
  } else if (severityBand === "yellow") {
    scoreCircle.classList.add("yellow-severity");
    statusDot.classList.add("yellow-status");
    labelText = "Moderate dump – scheduled clean-up";
    colourText = "Yellow (Moderate)";
    actionBadge.style.display = "none";
    moderateBadge.style.display = "inline-flex";
    lowBadge.style.display = "none";
    hazardPill.style.display = "inline-flex";
  } else {
    scoreCircle.classList.add("green-severity");
    statusDot.classList.add("green-status");
    labelText = "Minor dump – monitor and prevent";
    colourText = "Green (Low)";
    actionBadge.style.display = "none";
    moderateBadge.style.display = "none";
    lowBadge.style.display = "inline-flex";
    hazardPill.style.display = "none";
  }

  severityLabel.textContent = labelText;
  outColour.textContent = colourText;
  outCategory.textContent = categoryGuess;
  outVolume.textContent = volume;

  statusText.textContent = "Image analysed • Report generated";

  outJustification.textContent =
    `Estimated severity ${score}/10 based on image size (${metrics.totalPixels} pixels), ` +
    `average brightness ${metrics.avgBrightness}, and dark-area ratio ${metrics.darkRatio}. ` +
    `Higher dark ratio and larger dumps are treated as more severe.`;
}

analyseBtn.addEventListener("click", async () => {
  const file = imageInput.files[0];
  if (!file) {
    alert("Please upload an image first.");
    return;
  }

  analyseBtn.disabled = true;
  analyseBtn.textContent = "Scanning image...";
  statusText.textContent = "Analysing image content...";

  try {
    const result = await analyseImageFile(file);
    applySeverityToUI(result);
    await saveAnalysisResult(result);
  } catch (err) {
    console.error(err);
    alert("Could not analyse image. Try again.");
    statusText.textContent = "Analysis failed – try another image";
  } finally {
    analyseBtn.disabled = false;
    analyseBtn.textContent = "Scan image & build report";
  }
});


// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "garbedge-88515445",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Save analysis results to Firestore
async function saveAnalysisResult(result) {
  try {
    const docRef = await db.collection("analysis_results").add({
      result: result,
      timestamp: new Date(),
      url: window.location.href
    });
    console.log("Analysis result saved with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving analysis result: ", error);
  }
}

// Retrieve analysis results from Firestore
async function getAnalysisResults() {
  try {
    const querySnapshot = await db.collection("analysis_results").orderBy("timestamp", "desc").limit(10).get();
    const results = [];
    querySnapshot.forEach((doc) => {
      results.push({id: doc.id, ...doc.data()});
    });
    return results;
  } catch (error) {
    console.error("Error retrieving analysis results: ", error);
  }
}
