(function () {
  const digitCanvas = document.querySelector("#digit-canvas");
  const networkCanvas = document.querySelector("#network-canvas");

  if (!digitCanvas || !networkCanvas) {
    return;
  }

  const digitContext = digitCanvas.getContext("2d");
  const networkContext = networkCanvas.getContext("2d");
  const probabilityList = document.querySelector("[data-probabilities]");
  const predictionEl = document.querySelector("[data-digit-prediction]");
  const statusEl = document.querySelector("[data-game-status]");
  const clearButton = document.querySelector("[data-game-clear]");
  const templateCanvas = document.createElement("canvas");
  const templateContext = templateCanvas.getContext("2d");
  const digits = Array.from({ length: 10 }, (_, digit) => digit);
  const gridSize = 28;
  const digitCanvasSize = 280;
  const networkCanvasWidth = 460;
  const networkCanvasHeight = 280;
  let templates = [];

  let isDrawing = false;
  let lastPoint = null;
  let lastGuess = null;
  let probabilities = digits.map(() => 0.1);
  let activations = Array.from({ length: 12 }, () => 0.08);
  let mnistModel = null;
  let modelReady = false;
  let pixelRatio = 1;
  let activePointerId = null;

  setupCanvas();
  templates = digits.map((digit) => createTemplates(digit));
  buildProbabilityRows();
  clearDrawing();
  renderNetwork();
  updateProbabilities();
  loadMnistModel();

  digitCanvas.addEventListener("pointerdown", startDrawing);
  digitCanvas.addEventListener("pointermove", draw);
  digitCanvas.addEventListener("pointerup", stopDrawing);
  digitCanvas.addEventListener("pointercancel", stopDrawing);
  digitCanvas.addEventListener("pointerleave", stopDrawing);
  digitCanvas.addEventListener("touchstart", startTouchDrawing, { passive: false });
  digitCanvas.addEventListener("touchmove", touchDraw, { passive: false });
  digitCanvas.addEventListener("touchend", stopDrawing);
  digitCanvas.addEventListener("touchcancel", stopDrawing);
  clearButton?.addEventListener("click", clearDrawing);
  window.addEventListener("resize", resizeCanvases);

  function setupCanvas() {
    templateCanvas.width = gridSize;
    templateCanvas.height = gridSize;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    setCanvasResolution(digitCanvas, digitContext, digitCanvasSize, digitCanvasSize);
    setCanvasResolution(networkCanvas, networkContext, networkCanvasWidth, networkCanvasHeight);
    digitContext.fillStyle = "#09231d";
    digitContext.fillRect(0, 0, digitCanvasSize, digitCanvasSize);
    applyDigitDrawingStyle();
  }

  function resizeCanvases() {
    const drawingSnapshot = document.createElement("canvas");
    drawingSnapshot.width = digitCanvasSize;
    drawingSnapshot.height = digitCanvasSize;
    drawingSnapshot
      .getContext("2d")
      .drawImage(digitCanvas, 0, 0, digitCanvas.width, digitCanvas.height, 0, 0, digitCanvasSize, digitCanvasSize);

    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    setCanvasResolution(digitCanvas, digitContext, digitCanvasSize, digitCanvasSize);
    setCanvasResolution(networkCanvas, networkContext, networkCanvasWidth, networkCanvasHeight);
    digitContext.fillStyle = "#09231d";
    digitContext.fillRect(0, 0, digitCanvasSize, digitCanvasSize);
    digitContext.drawImage(drawingSnapshot, 0, 0);
    applyDigitDrawingStyle();
    renderNetwork();
  }

  function setCanvasResolution(canvas, context, logicalWidth, logicalHeight) {
    canvas.width = Math.round(logicalWidth * pixelRatio);
    canvas.height = Math.round(logicalHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function applyDigitDrawingStyle() {
    digitContext.lineCap = "round";
    digitContext.lineJoin = "round";
    digitContext.lineWidth = 22;
    digitContext.strokeStyle = "#baffd8";
    digitContext.fillStyle = "#baffd8";
  }

  function startDrawing(event) {
    event.preventDefault();
    isDrawing = true;
    activePointerId = event.pointerId;
    lastPoint = getPoint(event);
    if (typeof digitCanvas.setPointerCapture === "function") {
      digitCanvas.setPointerCapture(event.pointerId);
    }
    drawDot(lastPoint);
    classifyDrawing();
  }

  function draw(event) {
    if (!isDrawing || !lastPoint) {
      return;
    }

    if (activePointerId !== null && event.pointerId !== activePointerId) {
      return;
    }

    event.preventDefault();
    const point = getPoint(event);
    digitContext.beginPath();
    digitContext.moveTo(lastPoint.x, lastPoint.y);
    digitContext.lineTo(point.x, point.y);
    digitContext.stroke();
    lastPoint = point;
    classifyDrawing();
  }

  function startTouchDrawing(event) {
    if (!event.changedTouches.length) {
      return;
    }

    event.preventDefault();
    isDrawing = true;
    activePointerId = null;
    lastPoint = getPoint(event.changedTouches[0]);
    drawDot(lastPoint);
    classifyDrawing();
  }

  function touchDraw(event) {
    if (!isDrawing || !lastPoint || !event.changedTouches.length) {
      return;
    }

    event.preventDefault();
    const point = getPoint(event.changedTouches[0]);
    digitContext.beginPath();
    digitContext.moveTo(lastPoint.x, lastPoint.y);
    digitContext.lineTo(point.x, point.y);
    digitContext.stroke();
    lastPoint = point;
    classifyDrawing();
  }

  function stopDrawing() {
    if (!isDrawing) {
      return;
    }

    isDrawing = false;
    lastPoint = null;
    activePointerId = null;
  }

  function drawDot(point) {
    digitContext.beginPath();
    digitContext.arc(point.x, point.y, digitContext.lineWidth / 2, 0, Math.PI * 2);
    digitContext.fillStyle = digitContext.strokeStyle;
    digitContext.fill();
  }

  function getPoint(event) {
    const rect = digitCanvas.getBoundingClientRect();
    const scaleX = digitCanvasSize / rect.width;
    const scaleY = digitCanvasSize / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function classifyDrawing() {
    const input = normalizeDrawing();
    const ink = input.reduce((total, value) => total + value, 0);

    if (ink < 5) {
      probabilities = digits.map(() => 0.1);
      activations = activations.map(() => 0.08);
      lastGuess = null;
      predictionEl.textContent = "—";
      statusEl.textContent = "DRAW ANY DIGIT";
      updateProbabilities();
      renderNetwork();
      return;
    }

    probabilities = modelReady ? predictWithMnistModel(input) : predictWithPrototypeClassifier(input);
    lastGuess = probabilities.indexOf(Math.max(...probabilities));
    activations = makeActivations(input, probabilities);
    predictionEl.textContent = String(lastGuess);
    statusEl.textContent = `${modelReady ? "CNN" : "TEMPLATE"} ${lastGuess} · ${(probabilities[lastGuess] * 100).toFixed(0)}%`;
    updateProbabilities();
    renderNetwork();
  }

  async function loadMnistModel() {
    if (!window.tf) {
      statusEl.textContent = "TEMPLATE MODE";
      return;
    }

    try {
      statusEl.textContent = "LOADING CNN";
      mnistModel = await window.tf.loadLayersModel("./assets/mnist/model.json");
      modelReady = true;
      statusEl.textContent = "CNN READY";
    } catch (error) {
      modelReady = false;
      statusEl.textContent = "TEMPLATE MODE";
      console.warn("MNIST model failed to load; using template classifier.", error);
    }
  }

  function predictWithMnistModel(input) {
    const output = window.tf.tidy(() => {
      const tensor = window.tf.tensor4d(input, [1, gridSize, gridSize, 1]);
      return mnistModel.predict(tensor).dataSync();
    });

    return Array.from(output);
  }

  function predictWithPrototypeClassifier(input) {
    const similarities = templates.map((digitTemplates) => getDigitScore(input, digitTemplates));
    const featureAdjustments = getFeatureAdjustments(input);
    const scores = similarities.map((similarity, digit) => Math.exp((similarity + featureAdjustments[digit]) * 14));
    const total = scores.reduce((sum, value) => sum + value, 0);
    return scores.map((value) => value / total);
  }

  function normalizeDrawing() {
    const source = getLogicalImageData(digitCanvas, digitContext, digitCanvasSize, digitCanvasSize);
    const bounds = findInkBounds(source, digitCanvasSize, digitCanvasSize);

    templateContext.clearRect(0, 0, gridSize, gridSize);
    templateContext.fillStyle = "#000";
    templateContext.fillRect(0, 0, gridSize, gridSize);

    if (!bounds) {
      return new Array(gridSize * gridSize).fill(0);
    }

    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    const scale = Math.min(20 / width, 20 / height);
    const targetWidth = Math.max(1, width * scale);
    const targetHeight = Math.max(1, height * scale);
    const targetX = (gridSize - targetWidth) / 2;
    const targetY = (gridSize - targetHeight) / 2;

    templateContext.drawImage(
      digitCanvas,
      bounds.minX * pixelRatio,
      bounds.minY * pixelRatio,
      width * pixelRatio,
      height * pixelRatio,
      targetX,
      targetY,
      targetWidth,
      targetHeight
    );

    return thickenValues(imageDataToValues(templateContext.getImageData(0, 0, gridSize, gridSize)));
  }

  function getLogicalImageData(canvas, context, logicalWidth, logicalHeight) {
    if (pixelRatio === 1) {
      return context.getImageData(0, 0, logicalWidth, logicalHeight);
    }

    const snapshotCanvas = document.createElement("canvas");
    const snapshotContext = snapshotCanvas.getContext("2d");
    snapshotCanvas.width = logicalWidth;
    snapshotCanvas.height = logicalHeight;
    snapshotContext.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, logicalWidth, logicalHeight);
    return snapshotContext.getImageData(0, 0, logicalWidth, logicalHeight);
  }

  function getSimilarity(input, template) {
    let dot = 0;
    let inputMagnitude = 0;
    let templateMagnitude = 0;
    let overlap = 0;
    let inputInk = 0;
    let templateInk = 0;

    for (let index = 0; index < input.length; index += 1) {
      const inputValue = input[index];
      const templateValue = template[index];
      dot += inputValue * templateValue;
      inputMagnitude += inputValue * inputValue;
      templateMagnitude += templateValue * templateValue;
      overlap += Math.min(inputValue, templateValue);
      inputInk += inputValue;
      templateInk += templateValue;
    }

    const cosine = dot / (Math.sqrt(inputMagnitude) * Math.sqrt(templateMagnitude) || 1);
    const coverage = overlap / (Math.max(inputInk, templateInk) || 1);
    return cosine * 0.72 + coverage * 0.28;
  }

  function getDigitScore(input, digitTemplates) {
    const topScores = [];

    digitTemplates.forEach((template) => {
      const score = getSimilarity(input, template);
      const insertAt = topScores.findIndex((topScore) => score > topScore);

      if (insertAt === -1) {
        if (topScores.length < 5) {
          topScores.push(score);
        }
        return;
      }

      topScores.splice(insertAt, 0, score);
      if (topScores.length > 5) {
        topScores.pop();
      }
    });

    return topScores.reduce((total, score) => total + score, 0) / topScores.length;
  }

  function createTemplates(digit) {
    const fonts = ["Arial", "Helvetica", "Verdana", "Georgia"];
    const sizes = [24, 26];
    const rotations = [-0.1, 0, 0.1];
    const stretches = [
      [1, 1],
      [1.06, 0.96],
    ];
    const offsets = [
      [0, 1],
      [-1, 1],
    ];
    const variants = [];

    fonts.forEach((fontFamily) => {
      sizes.forEach((size) => {
        rotations.forEach((rotation) => {
          stretches.forEach(([scaleX, scaleY]) => {
            offsets.forEach(([xOffset, yOffset]) => {
              variants.push([`${size}px ${fontFamily}, sans-serif`, xOffset, yOffset, rotation, scaleX, scaleY]);
            });
          });
        });
      });
    });

    const fontTemplates = variants.map(([font, xOffset, yOffset, rotation, scaleX, scaleY]) => {
      templateContext.clearRect(0, 0, gridSize, gridSize);
      templateContext.fillStyle = "#000";
      templateContext.fillRect(0, 0, gridSize, gridSize);
      templateContext.save();
      templateContext.translate(gridSize / 2, gridSize / 2);
      templateContext.rotate(rotation);
      templateContext.scale(scaleX, scaleY);
      templateContext.font = font;
      templateContext.textAlign = "center";
      templateContext.textBaseline = "middle";
      templateContext.lineCap = "round";
      templateContext.lineJoin = "round";
      templateContext.lineWidth = 2.2;
      templateContext.strokeStyle = "#fff";
      templateContext.strokeText(String(digit), xOffset, yOffset + 1);
      templateContext.lineWidth = 1;
      templateContext.strokeText(String(digit), xOffset, yOffset + 1);
      templateContext.restore();
      return thickenValues(imageDataToValues(templateContext.getImageData(0, 0, gridSize, gridSize)));
    });

    return fontTemplates;
  }

  function getFeatureAdjustments(input) {
    const adjustments = digits.map(() => 0);
    const topInk = regionAverage(input, 5, 2, 23, 8);
    const middleInk = regionAverage(input, 5, 11, 23, 17);
    const bottomInk = regionAverage(input, 5, 20, 23, 26);
    const leftInk = regionAverage(input, 2, 5, 10, 23);
    const rightInk = regionAverage(input, 18, 5, 26, 23);
    const centerInk = regionAverage(input, 10, 7, 18, 21);
    const upperLeftInk = regionAverage(input, 3, 5, 12, 13);
    const lowerLeftInk = regionAverage(input, 3, 15, 12, 24);

    if (rightInk > leftInk * 1.6 && topInk < 0.18 && bottomInk < 0.18) {
      adjustments[1] += 0.1;
      adjustments[7] -= 0.04;
    }

    if (topInk > 0.18 && rightInk > leftInk * 1.25 && lowerLeftInk < 0.18) {
      adjustments[7] += 0.08;
    }

    if (leftInk > 0.16 && rightInk > 0.16 && topInk > 0.13 && bottomInk > 0.13) {
      adjustments[0] += centerInk < 0.18 ? 0.08 : -0.02;
      adjustments[8] += centerInk > 0.14 && middleInk > 0.13 ? 0.08 : -0.02;
    }

    if (rightInk > leftInk * 1.2 && middleInk > 0.12) {
      adjustments[3] += 0.06;
    }

    if (upperLeftInk > 0.12 && middleInk > 0.12 && rightInk > 0.12) {
      adjustments[5] += 0.06;
    }

    if (lowerLeftInk > 0.14 && middleInk > 0.11 && rightInk > 0.1) {
      adjustments[6] += 0.05;
    }

    if (topInk > 0.13 && middleInk > 0.1 && bottomInk > 0.13 && leftInk < rightInk * 0.9) {
      adjustments[2] += 0.05;
    }

    return adjustments;
  }

  function regionAverage(values, left, top, right, bottom) {
    let total = 0;
    let count = 0;

    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        total += values[y * gridSize + x];
        count += 1;
      }
    }

    return total / count;
  }

  function imageDataToValues(imageData) {
    const values = [];
    for (let index = 0; index < imageData.data.length; index += 4) {
      const brightness = Math.max(imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]);
      values.push(brightness > 48 ? brightness / 255 : 0);
    }
    return values;
  }

  function thickenValues(values) {
    const thickened = values.slice();

    for (let y = 1; y < gridSize - 1; y += 1) {
      for (let x = 1; x < gridSize - 1; x += 1) {
        const index = y * gridSize + x;
        const neighborMax = Math.max(
          values[index],
          values[index - 1],
          values[index + 1],
          values[index - gridSize],
          values[index + gridSize]
        );
        thickened[index] = Math.max(thickened[index], neighborMax * 0.72);
      }
    }

    return thickened;
  }

  function findInkBounds(imageData, width, height) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const red = imageData.data[index];
        const green = imageData.data[index + 1];
        const blue = imageData.data[index + 2];
        const brightness = Math.max(red, green, blue);
        const isGreenStroke = green > 90 && green > red * 1.25;
        const isDarkStroke = brightness < 18;
        if (isGreenStroke || isDarkStroke) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    return maxX >= 0 ? { minX, minY, maxX, maxY } : null;
  }

  function makeActivations(input, output) {
    const regions = [
      [0, 0, 14, 14],
      [14, 0, 28, 14],
      [0, 14, 14, 28],
      [14, 14, 28, 28],
      [6, 0, 22, 9],
      [6, 9, 22, 19],
      [6, 19, 22, 28],
      [0, 6, 9, 22],
      [19, 6, 28, 22],
      [8, 8, 20, 20],
      [0, 0, 28, 28],
      [4, 4, 24, 24],
    ];

    return regions.map(([left, top, right, bottom], regionIndex) => {
      let sum = 0;
      let count = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          sum += input[y * gridSize + x];
          count += 1;
        }
      }

      const outputInfluence = output[regionIndex % output.length] || 0;
      return Math.min(1, sum / count + outputInfluence * 2.4);
    });
  }

  function buildProbabilityRows() {
    probabilityList.innerHTML = digits
      .map(
        (digit) => `
          <div class="probability-row" data-probability-row="${digit}">
            <span>${digit}</span>
            <div class="probability-track"><div class="probability-fill"></div></div>
            <span data-probability-value>10%</span>
          </div>
        `
      )
      .join("");
  }

  function updateProbabilities() {
    const topDigit = probabilities.indexOf(Math.max(...probabilities));
    document.querySelectorAll("[data-probability-row]").forEach((row) => {
      const digit = Number(row.getAttribute("data-probability-row"));
      const value = probabilities[digit] || 0;
      row.classList.toggle("is-top", digit === topDigit && lastGuess !== null);
      row.querySelector(".probability-fill").style.width = `${Math.round(value * 100)}%`;
      row.querySelector("[data-probability-value]").textContent = `${Math.round(value * 100)}%`;
    });
  }

  function renderNetwork() {
    const width = networkCanvasWidth;
    const height = networkCanvasHeight;
    networkContext.clearRect(0, 0, width, height);
    networkContext.fillStyle = "#09231d";
    networkContext.fillRect(0, 0, width, height);

    const inputNodes = makeColumn(55, height, 7);
    const hiddenNodes = makeColumn(220, height, 12);
    const outputNodes = makeColumn(390, height, 10);

    drawConnections(inputNodes, hiddenNodes, activations);
    drawConnections(hiddenNodes, outputNodes, probabilities);
    drawNodes(inputNodes, Array.from({ length: inputNodes.length }, (_, index) => activations[index % activations.length]));
    drawNodes(hiddenNodes, activations);
    drawNodes(outputNodes, probabilities);
    drawColumnLabel("PIXELS", 55, height - 14);
    drawColumnLabel("FEATURES", 220, height - 14);
    drawColumnLabel("DIGITS", 390, height - 14);
  }

  function makeColumn(x, height, count) {
    return Array.from({ length: count }, (_, index) => ({
      x,
      y: 30 + (index * (height - 68)) / Math.max(1, count - 1),
    }));
  }

  function drawConnections(fromNodes, toNodes, values) {
    fromNodes.forEach((fromNode, fromIndex) => {
      toNodes.forEach((toNode, toIndex) => {
        const value = values[(fromIndex + toIndex) % values.length] || 0;
        networkContext.strokeStyle = `rgba(186, 255, 216, ${0.025 + value * 0.12})`;
        networkContext.lineWidth = 0.45 + value * 1.1;
        networkContext.beginPath();
        networkContext.moveTo(fromNode.x, fromNode.y);
        networkContext.lineTo(toNode.x, toNode.y);
        networkContext.stroke();
      });
    });
  }

  function drawNodes(nodes, values) {
    nodes.forEach((node, index) => {
      const value = values[index % values.length] || 0;
      networkContext.beginPath();
      networkContext.arc(node.x, node.y, 5 + value * 7, 0, Math.PI * 2);
      networkContext.fillStyle = `rgba(186, 255, 216, ${0.12 + value * 0.72})`;
      networkContext.fill();
      networkContext.strokeStyle = `rgba(36, 180, 126, ${0.35 + value * 0.55})`;
      networkContext.stroke();
    });
  }

  function drawColumnLabel(label, x, y) {
    networkContext.fillStyle = "#648078";
    networkContext.font = "9px DM Mono, monospace";
    networkContext.textAlign = "center";
    networkContext.fillText(label, x, y);
  }

  function clearDrawing() {
    digitContext.fillStyle = "#09231d";
    digitContext.fillRect(0, 0, digitCanvasSize, digitCanvasSize);
    applyDigitDrawingStyle();
    probabilities = digits.map(() => 0.1);
    activations = Array.from({ length: 12 }, () => 0.08);
    lastGuess = null;
    predictionEl.textContent = "—";
    statusEl.textContent = "DRAW ANY DIGIT";
    updateProbabilities();
    renderNetwork();
  }
})();
