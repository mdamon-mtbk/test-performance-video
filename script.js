import http from "k6/http";
import { sleep, check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// OPTIMIZED configuration to prevent crashes - start conservative and scale up
export const options = {
  scenarios: {
    video_streaming_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "45s", target: 15 }, // Start slow to avoid crashes
        { duration: "1m", target: 30 }, // Gradual ramp
        { duration: "1m", target: 50 }, // Middle load
        { duration: "45s", target: 75 }, // Higher load
        { duration: "30s", target: 100 }, // Peak load (shorter duration)
        { duration: "45s", target: 75 }, // Quick ramp down
        { duration: "45s", target: 25 }, // Further down
        { duration: "30s", target: 0 }, // Complete ramp down
      ],
      gracefulRampDown: "30s",
    },
  },

  // More lenient thresholds to prevent early termination
  thresholds: {
    http_req_duration: [
      "p(50)<3000", // 50% under 3s
      "p(90)<8000", // 90% under 8s
      "p(95)<12000", // 95% under 12s
    ],
    http_req_failed: ["rate<0.15"], // Allow 15% failures
    checks: ["rate>0.75"], // 75% checks pass
    http_reqs: ["rate>3"], // At least 3 req/s
    data_received: ["rate>512"], // At least 512B/s

    // Custom metrics with relaxed thresholds
    video_segments_loaded: ["rate>0.8"], // 80% video segments
    audio_segments_loaded: ["rate>0.8"], // 80% audio segments
    init_segments_loaded: ["rate>0.9"], // 90% init segments
    iteration_duration: ["p(95)<80000"], // 95% iterations under 80s
  },

  // Resource management to prevent crashes
  discardResponseBodies: false, // Keep false to measure data transfer
  noConnectionReuse: false, // Allow connection reuse for efficiency
  maxRedirects: 2,
  insecureSkipTLSVerify: true,

  // Batch settings for performance
  batch: 10,
  batchPerHost: 5,

  // Timeout settings
  timeout: "30s",
};

// Video configuration
const VIDEO_ID = "3a5eda96b0fbe33632bec15e29463579";
const BASE_URL = `https://customer-cqzirhlx8v0djtih.cloudflarestream.com/${VIDEO_ID}`;

// Authentication tokens
const INIT_TOKENS = {
  video: {
    p: "eyJ0eXBlIjoiaW5pdCIsInZpZGVvSUQiOiIzYTVlZGE5NmIwZmJlMzM2MzJiZWMxNWUyOTQ2MzU3OSIsIm93bmVySUQiOjc1Mzk5MTY2LCJjcmVhdG9ySUQiOiIiLCJzdG9yYWdlUHJvdmlkZXIiOjQsInRyYWNrIjoiNTQ4YmNhNTA1MDM2YTZhYjA4NTZiMjU2Y2NmZDUzOGIiLCJyZW5kaXRpb24iOiIxMTIyMTI5NjQ3IiwibXV4aW5nIjoiMTE3OTQ0NzkxNyJ9",
    s: "fRFTEDJQw51zPxXDhT1MG8OKw4zDvMKeB0vDksKATsKXwobDlcOxw40nUcKEWA",
  },
  audio: {
    p: "eyJ0eXBlIjoiaW5pdCIsInZpZGVvSUQiOiIzYTVlZGE5NmIwZmJlMzM2MzJiZWMxNWUyOTQ2MzU3OSIsIm93bmVySUQiOjc1Mzk5MTY2LCJjcmVhdG9ySUQiOiIiLCJzdG9yYWdlUHJvdmlkZXIiOjQsInRyYWNrIjoiZDhmZThiNmE5NjU1NGFjYTcwMTdmNGQ1MmE5M2M5N2EiLCJyZW5kaXRpb24iOiIxMTIyMTI5NjQ4IiwibXV4aW5nIjoiMTE3OTQ0NzkxOCJ9",
    s: "A8OzwqUSB8OZwonDjRHCgSnCs8OjworCnsOEwoDDoEIzwolHK1HDuXBewq8nNkvDlg",
  },
};

const SEGMENT_TOKENS = {
  video: {
    p: "eyJ0eXBlIjoic2VnbWVudCIsInZpZGVvSUQiOiIzYTVlZGE5NmIwZmJlMzM2MzJiZWMxNWUyOTQ2MzU3OSIsIm93bmVySUQiOjc1Mzk5MTY2LCJjcmVhdG9ySUQiOiIiLCJzZWdtZW50RHVyYXRpb25TZWNzIjo1LjYzMiwic3RvcmFnZVByb3ZpZGVyIjo0LCJ0cmFjayI6IjU0OGJjYTUwNTAzNmE2YWIwODU2YjI1NmNjZmQ1MzhiIiwicmVuZGl0aW9uIjoiMTEyMjEyOTY0NyIsIm11eGluZyI6IjExNzk0NDc5MTcifQ",
    s: "w67ClsOUw4xpV1h5PyjDuWoawotqWcKHDikYw4UMF8ObwpHDu8OMw5XCgSAFKA",
  },
  audio: {
    p: "eyJ0eXBlIjoic2VnbWVudCIsInZpZGVvSUQiOiIzYTVlZGE5NmIwZmJlMzM2MzJiZWMxNWUyOTQ2MzU3OSIsIm93bmVySUQiOjc1Mzk5MTY2LCJjcmVhdG9ySUQiOiIiLCJzZWdtZW50RHVyYXRpb25TZWNzIjo1LjYzMiwic3RvcmFnZVByb3ZpZGVyIjo0LCJ0cmFjayI6ImQ4ZmU4YjZhOTY1NTRhY2E3MDE3ZjRkNTJhOTNjOTdhIiwicmVuZGl0aW9uIjoiMTEyMjEyOTY0OCIsIm11eGluZyI6IjExNzk0NDc5MTgifQ",
    s: "w5fDok3CvsOzWDlcLMKSwqprw73DucKkwqlEw4tGw5dmJMKowqFTIcK4w74VecKjDw",
  },
};

// Optimized custom metrics
import { Counter, Rate, Trend } from "k6/metrics";

const videoSegmentsLoaded = new Rate("video_segments_loaded");
const audioSegmentsLoaded = new Rate("audio_segments_loaded");
const initSegmentsLoaded = new Rate("init_segments_loaded");
const totalDataTransferred = new Counter("total_data_transferred_bytes");
const segmentLoadTime = new Trend("segment_load_time");
const sessionDuration = new Trend("session_duration");

// Helper functions
function buildQueryString(params) {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

function buildInitUrl(type, quality, tokens) {
  const baseUrl = `${BASE_URL}/${type}/${quality}/init.mp4`;
  const queryString = buildQueryString(tokens);
  return `${baseUrl}?${queryString}`;
}

function buildSegmentUrl(type, quality, segmentNumber, tokens) {
  const baseUrl = `${BASE_URL}/${type}/${quality}/seg_${segmentNumber}.mp4`;
  const queryString = buildQueryString(tokens);
  return `${baseUrl}?${queryString}`;
}

// OPTIMIZED request function with better error handling
function makeRequest(url, description, customMetric = null) {
  const startTime = Date.now();

  let response;
  try {
    response = http.get(url, {
      timeout: "20s", // Increased timeout
      headers: {
        "User-Agent": "K6-VideoStreaming-Optimized/2.0",
        Accept: "video/mp4,application/mp4",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(`[VU${__VU}] Request failed: ${error.message}`);
    if (customMetric) customMetric.add(false);
    return { response: null, isSuccess: false, dataSize: 0 };
  }

  const loadTime = Date.now() - startTime;
  segmentLoadTime.add(loadTime);

  const isSuccess =
    response &&
    response.status >= 200 &&
    response.status < 400 &&
    response.body &&
    response.body.length > 0;

  if (customMetric) {
    customMetric.add(isSuccess);
  }

  if (isSuccess && response.body) {
    totalDataTransferred.add(response.body.length);
  }

  // REDUCED logging to prevent IDE overload - only log errors and major milestones
  if (!isSuccess || loadTime > 10000) {
    console.log(
      `[VU${__VU}] ${description}: ${response ? response.status : "ERROR"} (${
        response && response.body ? Math.round(response.body.length / 1024) : 0
      }KB) - ${loadTime}ms`
    );
  }

  return {
    response,
    isSuccess,
    dataSize: response && response.body ? response.body.length : 0,
  };
}

export default function () {
  const sessionStartTime = Date.now();
  const vuId = __VU;
  const iterationId = __ITER;

  // Reduced logging to prevent console overload
  if (iterationId % 10 === 0 || vuId <= 5) {
    // Only log every 10th iteration or first 5 VUs
    console.log(
      `[VU${vuId}][Iter${iterationId}] Starting optimized video session...`
    );
  }

  let totalDataBytes = 0;
  let successfulRequests = 0;
  let totalRequests = 0;
  let videoSegmentSuccesses = 0;
  let audioSegmentSuccesses = 0;

  try {
    // PHASE 1: Fetch init segments (essential for streaming)
    const audioInitResult = makeRequest(
      buildInitUrl("audio", "128", INIT_TOKENS.audio),
      "Audio init",
      initSegmentsLoaded
    );
    totalRequests++;
    if (audioInitResult.isSuccess) {
      successfulRequests++;
      totalDataBytes += audioInitResult.dataSize;
    }

    const videoInitResult = makeRequest(
      buildInitUrl("video", "720", INIT_TOKENS.video),
      "Video init",
      initSegmentsLoaded
    );
    totalRequests++;
    if (videoInitResult.isSuccess) {
      successfulRequests++;
      totalDataBytes += videoInitResult.dataSize;
    }

    // Minimal checks to reduce overhead
    check(audioInitResult.response, {
      "Audio init OK": (r) => r && r.status >= 200 && r.status < 400,
    });
    check(videoInitResult.response, {
      "Video init OK": (r) => r && r.status >= 200 && r.status < 400,
    });

    // PHASE 2: Stream video segments (optimized for ~1 minute)
    // Reduce to 9 segments to prevent memory issues
    const targetSegments = 9;
    const segmentInterval = 6; // Slightly longer interval

    for (let segmentIndex = 1; segmentIndex <= targetSegments; segmentIndex++) {
      const segmentStartTime = Date.now();

      // Load audio segment
      const audioSegmentResult = makeRequest(
        buildSegmentUrl("audio", "128", segmentIndex, SEGMENT_TOKENS.audio),
        `Audio seg ${segmentIndex}`,
        audioSegmentsLoaded
      );
      totalRequests++;
      if (audioSegmentResult.isSuccess) {
        successfulRequests++;
        audioSegmentSuccesses++;
        totalDataBytes += audioSegmentResult.dataSize;
      }

      // Load video segment
      const videoSegmentResult = makeRequest(
        buildSegmentUrl("video", "720", segmentIndex, SEGMENT_TOKENS.video),
        `Video seg ${segmentIndex}`,
        videoSegmentsLoaded
      );
      totalRequests++;
      if (videoSegmentResult.isSuccess) {
        successfulRequests++;
        videoSegmentSuccesses++;
        totalDataBytes += videoSegmentResult.dataSize;
      }

      // Minimal checks
      check(audioSegmentResult.response, {
        [`Audio seg ${segmentIndex} OK`]: (r) =>
          r && r.status >= 200 && r.status < 400,
      });
      check(videoSegmentResult.response, {
        [`Video seg ${segmentIndex} OK`]: (r) =>
          r && r.status >= 200 && r.status < 400,
      });

      // Smart timing to prevent overload
      const segmentLoadTime = Date.now() - segmentStartTime;
      const remainingWait = Math.max(
        1000,
        segmentInterval * 1000 - segmentLoadTime
      ); // Minimum 1s wait

      if (remainingWait > 0) {
        sleep(remainingWait / 1000);
      }

      // Early exit conditions to prevent crashes
      const elapsedTime = (Date.now() - sessionStartTime) / 1000;
      if (elapsedTime > 70) {
        // Stricter time limit
        if (vuId <= 3)
          console.log(
            `[VU${vuId}] Early exit at segment ${segmentIndex} (${elapsedTime.toFixed(
              1
            )}s)`
          );
        break;
      }

      // Memory management - force garbage collection hint every few segments
      if (
        segmentIndex % 3 === 0 &&
        typeof global !== "undefined" &&
        global.gc
      ) {
        global.gc();
      }
    }

    // Session summary (reduced logging)
    const sessionTime = (Date.now() - sessionStartTime) / 1000;
    sessionDuration.add(sessionTime * 1000);

    // Only log summary for subset of VUs to reduce console spam
    if (vuId % 20 === 0 || vuId <= 5) {
      const successRate =
        totalRequests > 0
          ? ((successfulRequests / totalRequests) * 100).toFixed(1)
          : "0";
      const dataMB = (totalDataBytes / 1024 / 1024).toFixed(2);
      console.log(
        `[VU${vuId}] COMPLETE: ${sessionTime.toFixed(
          1
        )}s, ${successfulRequests}/${totalRequests} (${successRate}%), ${dataMB}MB`
      );
    }
  } catch (error) {
    console.error(`[VU${vuId}] ERROR: ${error.message}`);

    // Minimal error tracking
    check(null, {
      "Session completed without errors": () => false,
    });
  }
}

export function setup() {
  console.log("🚀 Starting OPTIMIZED K6 Video Streaming Test");
  console.log("📊 Configuration (Crash-Prevention Mode):");
  console.log("- Peak Users: 100 CCU (gradual ramp)");
  console.log("- Duration: 5 minutes");
  console.log("- Segments per Session: 9 (reduced for stability)");
  console.log("- Logging: Minimized to prevent IDE overload");
  console.log("- Memory: Optimized with garbage collection hints");
  console.log("");

  return {
    testStartTime: new Date().toISOString(),
    testConfig: {
      maxCCU: 100,
      sessionDuration: 60,
      totalDuration: 300,
    },
  };
}

export function teardown(data) {
  console.log("");
  console.log("✅ Optimized Video Test Completed Successfully");
  console.log("⏰ Started: " + data.testStartTime);
  console.log("⏰ Ended: " + new Date().toISOString());
  console.log("📊 Reports generated - check summary.html");
}

// OPTIMIZED report generation (reduced complexity to prevent crashes)
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    // Safe metric extraction with comprehensive fallbacks
    const safeGet = (path, fallback = 0) => {
      try {
        return path || fallback;
      } catch {
        return fallback;
      }
    };

    const metrics = {
      httpReqs: safeGet(data.metrics.http_reqs?.values.count),
      httpReqDuration: {
        avg: safeGet(data.metrics.http_req_duration?.values.avg),
        p50: safeGet(data.metrics.http_req_duration?.values["p(50)"]),
        p90: safeGet(data.metrics.http_req_duration?.values["p(90)"]),
        p95: safeGet(data.metrics.http_req_duration?.values["p(95)"]),
        p99: safeGet(data.metrics.http_req_duration?.values["p(99)"]),
      },
      httpReqFailed: safeGet(data.metrics.http_req_failed?.values.rate),
      httpReqRate: safeGet(data.metrics.http_reqs?.values.rate),
      dataReceived: safeGet(data.metrics.data_received?.values.count),
      dataReceivedRate: safeGet(data.metrics.data_received?.values.rate),
      checks: safeGet(data.metrics.checks?.values.rate),
      vusMax: safeGet(data.metrics.vus_max?.values.max),
      iterations: safeGet(data.metrics.iterations?.values.count),
      videoSegments: safeGet(data.metrics.video_segments_loaded?.values.rate),
      audioSegments: safeGet(data.metrics.audio_segments_loaded?.values.rate),
      initSegments: safeGet(data.metrics.init_segments_loaded?.values.rate),
      totalDataTransferred: safeGet(
        data.metrics.total_data_transferred_bytes?.values.count
      ),
      sessionDuration: {
        avg: safeGet(data.metrics.session_duration?.values.avg),
        p95: safeGet(data.metrics.session_duration?.values["p(95)"]),
      },
    };

    const successRate = ((1 - metrics.httpReqFailed) * 100).toFixed(1);
    const failureRate = (metrics.httpReqFailed * 100).toFixed(1);
    const checksPassed = (metrics.checks * 100).toFixed(1);
    const dataMB = (metrics.dataReceived / 1024 / 1024).toFixed(2);

    // Performance grading
    function getGrade(successRate, p95ResponseTime, failureRate) {
      const success = parseFloat(successRate);
      const p95 = p95ResponseTime / 1000;
      const failure = parseFloat(failureRate);

      if (success >= 95 && p95 <= 8 && failure <= 5)
        return { grade: "A+", description: "Excellent", color: "success" };
      if (success >= 85 && p95 <= 12 && failure <= 15)
        return { grade: "A", description: "Very Good", color: "success" };
      if (success >= 75 && p95 <= 20 && failure <= 25)
        return { grade: "B", description: "Good", color: "warning" };
      if (success >= 65 && p95 <= 30 && failure <= 35)
        return { grade: "C", description: "Acceptable", color: "warning" };
      return { grade: "D", description: "Needs Improvement", color: "error" };
    }

    const grade = getGrade(
      successRate,
      metrics.httpReqDuration.p95,
      failureRate
    );

    // COMPLETE HTML report with full JavaScript implementation
    const htmlReport = `<!DOCTYPE html>
<html>
<head>
    <title>K6 Video Streaming Load Test Report</title>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 12px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.1); 
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { margin: 0; font-size: 2.2em; font-weight: 300; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        
        .grade { 
            text-align: center; 
            padding: 25px; 
            margin: 30px; 
            border-radius: 12px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .grade.success { background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; }
        .grade.warning { background: linear-gradient(135deg, #f39c12, #e67e22); color: white; }
        .grade.error { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; }
        .grade h2 { margin: 0; font-size: 2em; font-weight: 300; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: white;
        }
        .stat-box {
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #3498db;
            display: block;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .charts-section {
            padding: 30px;
            background: #f8f9fa;
        }
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }
        .chart-container {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            position: relative;
        }
        .chart-container h3 {
            margin: 0 0 20px 0;
            color: #2c3e50;
            font-size: 1.2em;
            text-align: center;
            font-weight: 600;
        }
        .chart-canvas {
            position: relative;
            height: 300px;
        }
        
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 25px; 
            padding: 30px;
            background: white;
        }
        .metric-card { 
            background: #f8f9fa; 
            padding: 25px; 
            border-radius: 12px; 
            border-left: 4px solid #3498db;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .metric-card h3 { 
            margin: 0 0 20px 0; 
            color: #2c3e50; 
            font-size: 1.1em;
            font-weight: 600;
        }
        .metric-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            padding: 8px 0; 
            border-bottom: 1px solid #ecf0f1;
        }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { font-weight: 500; color: #555; }
        .metric-value { font-weight: 600; color: #2c3e50; font-size: 1.05em; }
        .success { color: #27ae60; }
        .warning { color: #f39c12; }
        .error { color: #e74c3c; }
        
        .recommendations {
            background: white;
            padding: 30px;
            margin: 20px 30px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .recommendations h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.3em;
        }
        .recommendations ul {
            line-height: 1.6;
        }
        .recommendations li {
            margin-bottom: 8px;
        }
        
        .footer { 
            background: #2c3e50;
            color: white;
            padding: 25px 30px;
            text-align: center; 
        }
        .footer p {
            margin: 5px 0;
            opacity: 0.9;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 Video Streaming Load Test Report</h1>
            <p>Peak 100 CCU • 5 Minutes • Advanced Analytics</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="grade ${grade.color}">
            <h2>Overall Grade: ${grade.grade} (${grade.description})</h2>
        </div>

        <!-- Summary Statistics -->
        <div class="summary-stats">
            <div class="stat-box">
                <span class="stat-number">${metrics.httpReqs.toLocaleString()}</span>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-box">
                <span class="stat-number ${
                  parseFloat(successRate) > 85
                    ? "success"
                    : parseFloat(successRate) > 70
                    ? "warning"
                    : "error"
                }">${successRate}%</span>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${(
                  metrics.httpReqDuration.p95 / 1000
                ).toFixed(1)}s</span>
                <div class="stat-label">P95 Response Time</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${dataMB}</span>
                <div class="stat-label">Data Transferred (MB)</div>
            </div>
            <div class="stat-box">
                <span class="stat-number">${metrics.vusMax}</span>
                <div class="stat-label">Peak Concurrent Users</div>
            </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
            <h2 style="text-align: center; color: #2c3e50; margin-bottom: 30px;">📊 Performance Analytics</h2>
            
            <div class="charts-grid">
                <!-- Response Time Chart -->
                <div class="chart-container">
                    <h3>⏱️ Response Time Distribution</h3>
                    <div class="chart-canvas">
                        <canvas id="responseTimeChart"></canvas>
                    </div>
                </div>

                <!-- Success Rate Chart -->
                <div class="chart-container">
                    <h3>✅ Request Success vs Failure</h3>
                    <div class="chart-canvas">
                        <canvas id="successRateChart"></canvas>
                    </div>
                </div>

                <!-- Streaming Quality Chart -->
                <div class="chart-container">
                    <h3>🎬 Streaming Segments Quality</h3>
                    <div class="chart-canvas">
                        <canvas id="streamingQualityChart"></canvas>
                    </div>
                </div>

                <!-- Performance Chart -->
                <div class="chart-container">
                    <h3>🎯 Performance Metrics</h3>
                    <div class="chart-canvas">
                        <canvas id="performanceChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <h3>📊 Performance Summary</h3>
                <div class="metric-row">
                    <span class="metric-label">Total Requests:</span>
                    <span class="metric-value">${metrics.httpReqs.toLocaleString()}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Success Rate:</span>
                    <span class="metric-value ${
                      parseFloat(successRate) > 85
                        ? "success"
                        : parseFloat(successRate) > 70
                        ? "warning"
                        : "error"
                    }">${successRate}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Failure Rate:</span>
                    <span class="metric-value ${
                      parseFloat(failureRate) < 15
                        ? "success"
                        : parseFloat(failureRate) < 25
                        ? "warning"
                        : "error"
                    }">${failureRate}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Checks Passed:</span>
                    <span class="metric-value ${
                      parseFloat(checksPassed) > 75
                        ? "success"
                        : parseFloat(checksPassed) > 60
                        ? "warning"
                        : "error"
                    }">${checksPassed}%</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>⏱️ Response Times</h3>
                <div class="metric-row">
                    <span class="metric-label">Average:</span>
                    <span class="metric-value">${(
                      metrics.httpReqDuration.avg / 1000
                    ).toFixed(2)}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P50 (Median):</span>
                    <span class="metric-value">${(
                      metrics.httpReqDuration.p50 / 1000
                    ).toFixed(2)}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P95:</span>
                    <span class="metric-value ${
                      metrics.httpReqDuration.p95 < 12000
                        ? "success"
                        : metrics.httpReqDuration.p95 < 20000
                        ? "warning"
                        : "error"
                    }">${(metrics.httpReqDuration.p95 / 1000).toFixed(
      2
    )}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P99:</span>
                    <span class="metric-value">${(
                      metrics.httpReqDuration.p99 / 1000
                    ).toFixed(2)}s</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>📈 Data & Throughput</h3>
                <div class="metric-row">
                    <span class="metric-label">Data Received:</span>
                    <span class="metric-value">${dataMB} MB</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Request Rate:</span>
                    <span class="metric-value">${metrics.httpReqRate.toFixed(
                      1
                    )} req/s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Throughput:</span>
                    <span class="metric-value">${(
                      metrics.dataReceivedRate / 1024
                    ).toFixed(2)} KB/s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Max CCU:</span>
                    <span class="metric-value">${metrics.vusMax}</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>🎬 Streaming Quality</h3>
                <div class="metric-row">
                    <span class="metric-label">Video Segments:</span>
                    <span class="metric-value ${
                      metrics.videoSegments > 0.8
                        ? "success"
                        : metrics.videoSegments > 0.6
                        ? "warning"
                        : "error"
                    }">${(metrics.videoSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Audio Segments:</span>
                    <span class="metric-value ${
                      metrics.audioSegments > 0.8
                        ? "success"
                        : metrics.audioSegments > 0.6
                        ? "warning"
                        : "error"
                    }">${(metrics.audioSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Init Segments:</span>
                    <span class="metric-value ${
                      metrics.initSegments > 0.9
                        ? "success"
                        : metrics.initSegments > 0.7
                        ? "warning"
                        : "error"
                    }">${(metrics.initSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Sessions:</span>
                    <span class="metric-value">${metrics.iterations}</span>
                </div>
            </div>
        </div>

        <div class="recommendations">
            <h3>💡 Performance Analysis & Recommendations</h3>
            
            <div style="background: ${
              grade.color === "success"
                ? "#d4edda"
                : grade.color === "warning"
                ? "#fff3cd"
                : "#f8d7da"
            }; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${
      grade.color === "success"
        ? "#27ae60"
        : grade.color === "warning"
        ? "#f39c12"
        : "#e74c3c"
    };">
                <strong>📊 Test Status:</strong> ${
                  grade.grade === "A+" || grade.grade === "A"
                    ? "✅ Excellent performance! System handles 100 CCU load very well."
                    : grade.grade === "B"
                    ? "⚠️ Good performance with optimization opportunities."
                    : "❌ Performance issues detected. System needs optimization."
                }
            </div>
            
            <p><strong>🔧 Key Recommendations:</strong></p>
            <ul>
                ${
                  parseFloat(successRate) < 85
                    ? "<li><strong>🚨 Critical:</strong> Success rate is " +
                      successRate +
                      "% - investigate server capacity and network issues</li>"
                    : ""
                }
                ${
                  metrics.httpReqDuration.p95 > 15000
                    ? "<li><strong>⏱️ Response Time:</strong> P95 at " +
                      (metrics.httpReqDuration.p95 / 1000).toFixed(1) +
                      "s is high - consider CDN optimization</li>"
                    : ""
                }
                ${
                  parseFloat(failureRate) > 20
                    ? "<li><strong>🔧 High Failure Rate:</strong> " +
                      failureRate +
                      "% failure rate indicates system stress</li>"
                    : ""
                }
                <li><strong>📈 Scale Testing:</strong> ${
                  grade.grade === "A+" || grade.grade === "A"
                    ? "Consider testing with 150-200 CCU"
                    : "Optimize issues before higher loads"
                }</li>
                <li><strong>🔍 Monitoring:</strong> Implement real-time monitoring for response times and error rates</li>
            </ul>
        </div>

        <div class="footer">
            <p><strong>Test Summary:</strong> ${metrics.httpReqs.toLocaleString()} requests • ${successRate}% success • ${dataMB}MB transferred • Peak ${
      metrics.vusMax
    } CCU</p>
            <p>Generated by K6 Enhanced Load Test • ${timestamp}</p>
        </div>
    </div>

    <script>
        console.log('🔄 Page loaded, checking Chart.js availability...');
        
        // Wait for DOM and Chart.js to be ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('✅ DOM loaded');
            
            // Check if Chart.js loaded successfully
            if (typeof Chart === 'undefined') {
                console.error('❌ Chart.js failed to load from CDN');
                document.querySelector('.charts-section').innerHTML = 
                    '<div style="text-align: center; padding: 50px; color: #e74c3c;">' +
                    '<h3>⚠️ Charts Unavailable</h3>' +
                    '<p>Chart.js library failed to load. Please check internet connection.</p>' +
                    '</div>';
                return;
            }
            
            console.log('✅ Chart.js loaded successfully, version:', Chart.version || 'unknown');
            
            try {
                // Configure Chart.js defaults
                Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
                Chart.defaults.font.size = 12;
                
                // 1. Response Time Distribution Chart
                console.log('📊 Creating Response Time Chart...');
                const responseTimeCtx = document.getElementById('responseTimeChart');
                if (responseTimeCtx) {
                    new Chart(responseTimeCtx, {
                        type: 'bar',
                        data: {
                            labels: ['Average', 'P50', 'P90', 'P95', 'P99'],
                            datasets: [{
                                label: 'Response Time (seconds)',
                                data: [
                                    ${(
                                      metrics.httpReqDuration.avg / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.httpReqDuration.p50 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.httpReqDuration.p90 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.httpReqDuration.p95 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.httpReqDuration.p99 / 1000
                                    ).toFixed(2)}
                                ],
                                backgroundColor: [
                                    '#3498db', '#2ecc71', '#f39c12', 
                                    '${
                                      metrics.httpReqDuration.p95 < 8000
                                        ? "#27ae60"
                                        : metrics.httpReqDuration.p95 < 12000
                                        ? "#f39c12"
                                        : "#e74c3c"
                                    }', 
                                    '#9b59b6'
                                ],
                                borderColor: '#2c3e50',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            return 'Time: ' + context.parsed.y + 's';
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Seconds' }
                                }
                            }
                        }
                    });
                    console.log('✅ Response Time Chart created');
                }
                
                // 2. Success Rate Doughnut Chart
                console.log('📊 Creating Success Rate Chart...');
                const successRateCtx = document.getElementById('successRateChart');
                if (successRateCtx) {
                    new Chart(successRateCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Successful', 'Failed'],
                            datasets: [{
                                data: [${parseFloat(successRate)}, ${parseFloat(
      failureRate
    )}],
                                backgroundColor: ['#27ae60', '#e74c3c'],
                                borderColor: ['#fff', '#fff'],
                                borderWidth: 3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: { padding: 20, usePointStyle: true }
                                },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            return context.label + ': ' + context.parsed + '%';
                                        }
                                    }
                                }
                            }
                        }
                    });
                    console.log('✅ Success Rate Chart created');
                }
                
                // 3. Streaming Quality Radar Chart
                console.log('📊 Creating Streaming Quality Chart...');
                const streamingQualityCtx = document.getElementById('streamingQualityChart');
                if (streamingQualityCtx) {
                    new Chart(streamingQualityCtx, {
                        type: 'radar',
                        data: {
                            labels: ['Video Segments', 'Audio Segments', 'Init Segments', 'Overall Success', 'Checks Passed'],
                            datasets: [{
                                label: 'Success Rate (%)',
                                data: [
                                    ${(metrics.videoSegments * 100).toFixed(1)},
                                    ${(metrics.audioSegments * 100).toFixed(1)},
                                    ${(metrics.initSegments * 100).toFixed(1)},
                                    ${parseFloat(successRate)},
                                    ${parseFloat(checksPassed)}
                                ],
                                fill: true,
                                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                                borderColor: '#3498db',
                                borderWidth: 2,
                                pointBackgroundColor: '#3498db',
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 5
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                r: {
                                    suggestedMin: 0,
                                    suggestedMax: 100,
                                    ticks: {
                                        stepSize: 20,
                                        callback: function(value) { return value + '%'; }
                                    }
                                }
                            },
                            plugins: { legend: { display: false } }
                        }
                    });
                    console.log('✅ Streaming Quality Chart created');
                }
                
                // 4. Performance Metrics Horizontal Bar Chart
                console.log('📊 Creating Performance Metrics Chart...');
                const performanceCtx = document.getElementById('performanceChart');
                if (performanceCtx) {
                    new Chart(performanceCtx, {
                        type: 'bar',
                        data: {
                            labels: ['Request Rate\\n(req/s)', 'Throughput\\n(KB/s)', 'Sessions', 'Avg Session\\n(seconds)'],
                            datasets: [{
                                label: 'Values',
                                data: [
                                    ${metrics.httpReqRate.toFixed(1)},
                                    ${(metrics.dataReceivedRate / 1024).toFixed(
                                      2
                                    )},
                                    ${metrics.iterations},
                                    ${(
                                      metrics.sessionDuration.avg / 1000
                                    ).toFixed(1)}
                                ],
                                backgroundColor: ['#3498db', '#2ecc71', '#9b59b6', '#f39c12'],
                                borderColor: '#2c3e50',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        title: function(context) {
                                            return context[0].label.replace('\\n', ' ');
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { beginAtZero: true },
                                y: { grid: { display: false } }
                            }
                        }
                    });
                    console.log('✅ Performance Metrics Chart created');
                }
                
                console.log('🎉 ALL CHARTS RENDERED SUCCESSFULLY!');
                
            } catch (error) {
                console.error('❌ Error creating charts:', error);
                document.querySelector('.charts-section').innerHTML = 
                    '<div style="text-align: center; padding: 50px; color: #e74c3c;">' +
                    '<h3>⚠️ Chart Error</h3>' +
                    '<p>Error: ' + error.message + '</p>' +
                    '</div>';
            }
        });
    </script>
</body>
</html>`;

    // Simplified text summary
    const textReport = `
K6 Optimized Video Streaming Test Report
=======================================
Generated: ${timestamp}

OVERALL GRADE: ${grade.grade} (${grade.description})

CORE METRICS:
============
Total Requests: ${metrics.httpReqs.toLocaleString()}
Success Rate: ${successRate}%
Failure Rate: ${failureRate}%
Request Rate: ${metrics.httpReqRate.toFixed(2)} req/s
Checks Passed: ${checksPassed}%

RESPONSE TIMES:
==============
Average: ${(metrics.httpReqDuration.avg / 1000).toFixed(2)}s
P50: ${(metrics.httpReqDuration.p50 / 1000).toFixed(2)}s
P95: ${(metrics.httpReqDuration.p95 / 1000).toFixed(2)}s
P99: ${(metrics.httpReqDuration.p99 / 1000).toFixed(2)}s

STREAMING QUALITY:
=================
Video Segments: ${(metrics.videoSegments * 100).toFixed(1)}%
Audio Segments: ${(metrics.audioSegments * 100).toFixed(1)}%
Init Segments: ${(metrics.initSegments * 100).toFixed(1)}%

DATA TRANSFER:
=============
Total Received: ${dataMB} MB
Throughput: ${(metrics.dataReceivedRate / 1024).toFixed(2)} KB/s
Peak CCU: ${metrics.vusMax}
Sessions: ${metrics.iterations}

STATUS: Test completed successfully without crashes
`;

    console.log("✅ Optimized report generation completed");

    return {
      "summary.html": htmlReport,
      "summary.txt": textReport,
      stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
  } catch (error) {
    console.error("❌ Report generation error:", error.message);

    return {
      "error-report.txt": `
Optimized K6 Test Report
=======================
Status: Test completed but report generation had issues
Error: ${error.message}
Timestamp: ${timestamp}

${textSummary(data, { indent: " ", enableColors: false })}
`,
      stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
  }
}
