/////////////////////////////////////////////////////////////////
//
// Adobe Illustrator : Logo Grid Lines
// v1.0
//
// This script generates a series of Grid Lines of selected artwork on a seperate layer.
//
//
// UPDATES
//
// v1.0 [ 2024-11-09 ]
// - Creates horizontal, vertical, and angular Grid Lines based on the selected artwork.
// - Grid Lines are generated as Solid, Black, 1px lines, on a separate layer named Gridlines.
// - Grid lines do not extend beyond the edges of the artboard.
//
/////////////////////////////////////////////////////////////////
//
// JS Code originally developed by Studio Gibbous www.studiogibbous.com
// Released under Creative Commons (CC) License
//
/////////////////////////////////////////////////////////////////

// Function to create a new layer and return it
function createNewLayer(layerName) {
  var doc = app.activeDocument;
  var newLayer = doc.layers.add();
  newLayer.name = layerName;
  return newLayer;
}

// Function to check if two points are equal
function arePointsEqual(p1, p2, tolerance) {
  tolerance = tolerance || 0.001; // Set default tolerance if not provided
  return (
    Math.abs(p1[0] - p2[0]) < tolerance && Math.abs(p1[1] - p2[1]) < tolerance
  );
}

// Function to check if two lines are identical
function areLinesEqual(line1, line2) {
  return (
    (arePointsEqual(line1[0], line2[0]) &&
      arePointsEqual(line1[1], line2[1])) ||
    (arePointsEqual(line1[0], line2[1]) && arePointsEqual(line1[1], line2[0]))
  );
}

// Function to create a guideline as one continuous line with no fill
function createGuideline(startX, startY, endX, endY, layer, existingLines) {
  var newLine = [
    [startX, startY],
    [endX, endY],
  ];

  // Check if this line already exists in existingLines
  for (var i = 0; i < existingLines.length; i++) {
    if (areLinesEqual(newLine, existingLines[i])) {
      return; // Skip creating the line if a duplicate is found
    }
  }

  // Add the new line to the existingLines array to keep track
  existingLines.push(newLine);

  // Create the actual guideline on the layer
  var doc = app.activeDocument;
  var line = layer.pathItems.add();
  line.setEntirePath(newLine);
  line.stroked = true;
  line.strokeWidth = 1; // Set line thickness to 1 pixel
  line.strokeColor = doc.swatches["[Registration]"].color; // Solid black color
  line.filled = false; // Ensure there is no fill
}

// Function to calculate the exact intersections of a line with the artboard edges
function getArtboardIntersections(startX, startY, dx, dy) {
  var doc = app.activeDocument;
  var artboard = doc.artboards[doc.artboards.getActiveArtboardIndex()];
  var artboardRect = artboard.artboardRect; // [left, top, right, bottom]

  var x1 = artboardRect[0]; // Left
  var y1 = artboardRect[1]; // Top
  var x2 = artboardRect[2]; // Right
  var y2 = artboardRect[3]; // Bottom

  var intersections = [];

  if (dx !== 0) {
    var t1 = (x1 - startX) / dx;
    var t2 = (x2 - startX) / dx;
    var yAtX1 = startY + t1 * dy;
    var yAtX2 = startY + t2 * dy;
    if (yAtX1 >= y2 && yAtX1 <= y1) intersections.push([x1, yAtX1]);
    if (yAtX2 >= y2 && yAtX2 <= y1) intersections.push([x2, yAtX2]);
  }
  if (dy !== 0) {
    var t3 = (y1 - startY) / dy;
    var t4 = (y2 - startY) / dy;
    var xAtY1 = startX + t3 * dx;
    var xAtY2 = startX + t4 * dx;
    if (xAtY1 >= x1 && xAtY1 <= x2) intersections.push([xAtY1, y1]);
    if (xAtY2 >= x1 && xAtY2 <= x2) intersections.push([xAtY2, y2]);
  }

  return intersections;
}

// Function to extend a line across the artboard while preserving the exact angle
function extendAcrossArtboard(
  startX,
  startY,
  endX,
  endY,
  layer,
  existingLines,
) {
  // Calculate direction vector
  var dx = endX - startX;
  var dy = endY - startY;

  // Get intersections in both directions
  var intersections = getArtboardIntersections(startX, startY, dx, dy);

  if (intersections.length >= 2) {
    // Sort intersections by distance to determine the farthest points
    intersections.sort(function (a, b) {
      var distA = Math.sqrt(
        Math.pow(a[0] - startX, 2) + Math.pow(a[1] - startY, 2),
      );
      var distB = Math.sqrt(
        Math.pow(b[0] - startX, 2) + Math.pow(b[1] - startY, 2),
      );
      return distA - distB;
    });

    // Use the farthest two points to create one continuous line
    var farthestPoint1 = intersections[0];
    var farthestPoint2 = intersections[intersections.length - 1];
    createGuideline(
      farthestPoint1[0],
      farthestPoint1[1],
      farthestPoint2[0],
      farthestPoint2[1],
      layer,
      existingLines,
    );
  }
}

// Function to process a single path item
function processPathItem(item, layer, existingLines) {
  var points = item.pathPoints;

  if (points) {
    for (var j = 0; j < points.length; j++) {
      var point = points[j];
      var startX = point.anchor[0];
      var startY = point.anchor[1];
      var nextPoint = points[(j + 1) % points.length];
      var endX = nextPoint.anchor[0];
      var endY = nextPoint.anchor[1];

      // Extend the guideline preserving the exact direction of the artwork
      extendAcrossArtboard(startX, startY, endX, endY, layer, existingLines);
    }
  }
}

// Recursive function to process all items in a group or compound path
function processGroupItem(item, layer, existingLines) {
  if (item.typename === "GroupItem") {
    for (var i = 0; i < item.pageItems.length; i++) {
      processGroupItem(item.pageItems[i], layer, existingLines);
    }
  } else if (item.typename === "CompoundPathItem") {
    for (var j = 0; j < item.pathItems.length; j++) {
      processPathItem(item.pathItems[j], layer, existingLines);
    }
  } else if (item.typename === "PathItem") {
    processPathItem(item, layer, existingLines);
  }
}

// Function to process all selected items
function processSelectedItems() {
  var doc = app.activeDocument;
  var selection = doc.selection;

  if (selection.length === 0) {
    alert("Please select artwork.");
    return;
  }

  var newLayer = createNewLayer("Gridlines");
  var existingLines = []; // Keep track of created lines to avoid duplicates

  for (var i = 0; i < selection.length; i++) {
    processGroupItem(selection[i], newLayer, existingLines);
  }
}

// Run the main function
processSelectedItems();
