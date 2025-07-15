import http from "k6/http";
import { sleep, check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// ENHANCED configuration with VUser tracking
export const options = {
  scenarios: {
    video_streaming_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "3m", target: 50 }, // Slow start
        { duration: "3m", target: 150 }, // Gradual ramp
        { duration: "3m", target: 250 }, // Continue building
        { duration: "3m", target: 350 }, // Higher load
        { duration: "3m", target: 500 }, // Reach peak 500 CCU
        { duration: "10m", target: 500 }, // Sustain 500 CCU for 10 mins
        { duration: "2m", target: 350 }, // Start ramp down
        { duration: "2m", target: 150 }, // Continue ramp down
        { duration: "1m", target: 0 }, // Complete shutdown
      ],
      gracefulRampDown: "30s",
    },
  },

  thresholds: {
    http_req_duration: [
      "p(50)<5000", // More lenient for 500 CCU
      "p(90)<12000", // Increased tolerance
      "p(95)<18000", // Higher P95 threshold
      "p(99)<30000", // Higher P99 threshold
    ],
    http_req_failed: ["rate<0.25"], // Allow 25% failures at peak load
    checks: ["rate>0.60"], // Lower check threshold
    http_reqs: ["rate>10"], // Higher request rate expected
    data_received: ["rate>2048"], // Higher data rate expected

    // Enhanced custom metrics with relaxed thresholds
    video_segments_loaded: ["rate>0.70"], // 70% success for high load
    audio_segments_loaded: ["rate>0.70"], // 70% success for high load
    init_segments_loaded: ["rate>0.80"], // 80% init success
    iteration_duration: ["p(95)<120000"], // 2 minutes max per iteration
    vuser_requests: ["count>0"],
    streaming_session_quality: ["rate>0.65"], // 65% session quality
  },

  discardResponseBodies: false,
  noConnectionReuse: false,
  maxRedirects: 2,
  insecureSkipTLSVerify: true,
  batch: 15,
  batchPerHost: 8,
  timeout: "45s",
};

// Video configuration
const VIDEO_ID = "3a5eda96b0fbe33632bec15e29463579";
const BASE_URL = `https://customer-cqzirhlx8v0djtih.cloudflarestream.com/${VIDEO_ID}`;

// Segment timing configuration - realistic streaming simulation
const SEGMENT_DURATION_SECONDS = 5.632; // From token payload
const STREAMING_DURATION_SECONDS = 300; // 1 minute streaming session
const TOTAL_SEGMENTS_NEEDED = Math.ceil(
  STREAMING_DURATION_SECONDS / SEGMENT_DURATION_SECONDS
); // ~11 segments
const SEGMENT_FETCH_INTERVAL = SEGMENT_DURATION_SECONDS * 1000; // Fetch interval in ms

// Authentication tokens (same as before)
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

// ENHANCED metrics with VUser tracking
import { Counter, Rate, Trend, Gauge } from "k6/metrics";

const videoSegmentsLoaded = new Rate("video_segments_loaded");
const audioSegmentsLoaded = new Rate("audio_segments_loaded");
const initSegmentsLoaded = new Rate("init_segments_loaded");
const totalDataTransferred = new Counter("total_data_transferred_bytes");
const segmentLoadTime = new Trend("segment_load_time");
const sessionDuration = new Trend("session_duration");
const vuserRequests = new Counter("vuser_requests"); // Track requests per VUser
const streamingSessionQuality = new Rate("streaming_session_quality");
const vuserActiveGauge = new Gauge("vuser_active_count"); // Current active VUsers
const segmentSuccessRate = new Rate("segment_success_rate"); // Per-segment success
const vuserSessionDuration = new Trend("vuser_session_duration"); // Per-VUser session time

// VUser tracking object - stores data for each VUser
const vuserStats = {};

// Helper functions (same as before)
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

// ENHANCED request function with VUser tracking
function makeRequest(url, description, customMetric = null, vuId = null) {
  const startTime = Date.now();

  let response;
  try {
    response = http.get(url, {
      timeout: "30s",
      headers: {
        "User-Agent": `K6-VideoStreaming-VU${vuId}/3.0`,
        Accept: "video/mp4,application/mp4",
        Connection: "keep-alive",
        "X-VUser-ID": vuId.toString(),
      },
    });
  } catch (error) {
    console.error(`[VU${vuId}] Request failed: ${error.message}`);
    if (customMetric) customMetric.add(false);
    segmentSuccessRate.add(false);
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

  if (customMetric) customMetric.add(isSuccess);
  segmentSuccessRate.add(isSuccess);

  if (isSuccess && response.body) {
    totalDataTransferred.add(response.body.length);
  }

  // Track VUser stats
  if (vuId && vuserStats[vuId]) {
    vuserStats[vuId].totalRequests++;
    vuserStats[vuId].successfulRequests += isSuccess ? 1 : 0;
    vuserStats[vuId].totalDataBytes +=
      response && response.body ? response.body.length : 0;
    vuserStats[vuId].responseTimes.push(loadTime);
  }

  // Count total requests for this VUser
  vuserRequests.add(1);

  // Reduced logging - only log errors or significant events
  if (!isSuccess || loadTime > 10000) {
    console.log(
      `[VU${vuId}] ${description}: ${response ? response.status : "ERROR"} (${
        response && response.body ? Math.round(response.body.length / 1024) : 0
      }KB) - ${loadTime}ms`
    );
  }

  return {
    response,
    isSuccess,
    dataSize: response && response.body ? response.body.length : 0,
    loadTime,
  };
}

export default function () {
  const sessionStartTime = Date.now();
  const vuId = __VU;
  const iterationId = __ITER;

  // Initialize VUser stats if not exists
  if (!vuserStats[vuId]) {
    vuserStats[vuId] = {
      vuId: vuId,
      totalRequests: 0,
      successfulRequests: 0,
      totalDataBytes: 0,
      responseTimes: [],
      sessionStartTime: sessionStartTime,
      iterationsCompleted: 0,
    };
  }

  // Update active VUser count
  vuserActiveGauge.add(1);

  if (vuId % 50 === 0 || vuId <= 2) {
    // Chỉ log mỗi 50 VU hoặc 2 VU đầu
    console.log(
      `[VU${vuId}][Iter${iterationId}] Starting realistic streaming session...`
    );
  }

  let sessionSuccessCount = 0;
  let sessionTotalCount = 0;

  try {
    // PHASE 1: Initialize streaming - fetch init segments
    console.log(`[VU${vuId}] Phase 1: Initializing stream...`);

    const audioInitResult = makeRequest(
      buildInitUrl("audio", "128", INIT_TOKENS.audio),
      "Audio init",
      initSegmentsLoaded,
      vuId
    );
    sessionTotalCount++;
    if (audioInitResult.isSuccess) sessionSuccessCount++;

    const videoInitResult = makeRequest(
      buildInitUrl("video", "720", INIT_TOKENS.video),
      "Video init",
      initSegmentsLoaded,
      vuId
    );
    sessionTotalCount++;
    if (videoInitResult.isSuccess) sessionSuccessCount++;

    // Comprehensive checks
    check(audioInitResult.response, {
      "Audio init successful": (r) => r && r.status >= 200 && r.status < 400,
      "Audio init has content": (r) => r && r.body && r.body.length > 0,
    });

    check(videoInitResult.response, {
      "Video init successful": (r) => r && r.status >= 200 && r.status < 400,
      "Video init has content": (r) => r && r.body && r.body.length > 0,
    });

    // PHASE 2: Realistic streaming simulation
    // Calculate segments to fetch based on actual streaming duration
    console.log(
      `[VU${vuId}] Phase 2: Streaming ${TOTAL_SEGMENTS_NEEDED} segments...`
    );

    for (
      let segmentIndex = 1;
      segmentIndex <= TOTAL_SEGMENTS_NEEDED;
      segmentIndex++
    ) {
      const segmentStartTime = Date.now();

      // Simulate concurrent audio/video segment loading (as real browsers do)
      const audioSegmentResult = makeRequest(
        buildSegmentUrl("audio", "128", segmentIndex, SEGMENT_TOKENS.audio),
        `Audio seg ${segmentIndex}/${TOTAL_SEGMENTS_NEEDED}`,
        audioSegmentsLoaded,
        vuId
      );
      sessionTotalCount++;
      if (audioSegmentResult.isSuccess) sessionSuccessCount++;

      const videoSegmentResult = makeRequest(
        buildSegmentUrl("video", "720", segmentIndex, SEGMENT_TOKENS.video),
        `Video seg ${segmentIndex}/${TOTAL_SEGMENTS_NEEDED}`,
        videoSegmentsLoaded,
        vuId
      );
      sessionTotalCount++;
      if (videoSegmentResult.isSuccess) sessionSuccessCount++;

      // Enhanced checks with detailed validation
      check(audioSegmentResult.response, {
        [`Audio seg ${segmentIndex} status OK`]: (r) =>
          r && r.status >= 200 && r.status < 400,
        [`Audio seg ${segmentIndex} has data`]: (r) =>
          r && r.body && r.body.length > 1000, // Minimum expected size
      });

      check(videoSegmentResult.response, {
        [`Video seg ${segmentIndex} status OK`]: (r) =>
          r && r.status >= 200 && r.status < 400,
        [`Video seg ${segmentIndex} has data`]: (r) =>
          r && r.body && r.body.length > 10000, // Video should be larger
      });

      // Realistic timing - wait for segment duration before fetching next
      const segmentLoadTime = Date.now() - segmentStartTime;
      const idealWaitTime = SEGMENT_FETCH_INTERVAL;
      const actualWaitTime = Math.max(1000, idealWaitTime - segmentLoadTime); // At least 1s

      if (actualWaitTime > 0) {
        sleep(actualWaitTime / 1000);
      }

      // Safety checks to prevent infinite loops
      const elapsedTime = (Date.now() - sessionStartTime) / 1000;
      if (elapsedTime > STREAMING_DURATION_SECONDS + 60) {
        // Max 90s per session
        console.log(
          `[VU${vuId}] Session timeout at segment ${segmentIndex} (${elapsedTime.toFixed(
            1
          )}s)`
        );
        break;
      }

      // Progress logging for key milestones
      if (segmentIndex % 5 === 0 || segmentIndex === TOTAL_SEGMENTS_NEEDED) {
        // Mỗi 5 segments
        const progress = ((segmentIndex / TOTAL_SEGMENTS_NEEDED) * 100).toFixed(
          0
        );
        console.log(
          `[VU${vuId}] Progress: ${progress}% (${segmentIndex}/${TOTAL_SEGMENTS_NEEDED}) - ${elapsedTime.toFixed(
            1
          )}s`
        );
      }
    }

    // PHASE 3: Session completion and stats
    const sessionTime = (Date.now() - sessionStartTime) / 1000;
    const sessionSuccessRate =
      sessionTotalCount > 0 ? sessionSuccessCount / sessionTotalCount : 0;

    // Update VUser session stats
    vuserStats[vuId].iterationsCompleted++;
    vuserStats[vuId].lastSessionDuration = sessionTime;
    vuserStats[vuId].lastSessionSuccessRate = sessionSuccessRate;

    // Record session metrics
    sessionDuration.add(sessionTime * 1000);
    vuserSessionDuration.add(sessionTime * 1000);
    streamingSessionQuality.add(sessionSuccessRate);

    // Detailed session summary
    const successRate = (
      (sessionSuccessCount / sessionTotalCount) *
      100
    ).toFixed(1);
    const dataMB = (vuserStats[vuId].totalDataBytes / 1024 / 1024).toFixed(2);

    // Session summary logging
    if (vuId % 100 === 0 || vuId <= 5) {
      // Chỉ log mỗi 100 VU
      console.log(
        `[VU${vuId}] SESSION COMPLETE: ` +
          `${sessionTime.toFixed(1)}s, ` +
          `${sessionSuccessCount}/${sessionTotalCount} (${successRate}%), ` +
          `${dataMB}MB total, ` +
          `${vuserStats[vuId].totalRequests} lifetime requests`
      );
    }
  } catch (error) {
    console.error(`[VU${vuId}] CRITICAL ERROR: ${error.message}`);

    check(null, {
      "Session completed without critical errors": () => false,
    });
  } finally {
    // Update active VUser count (decrement)
    vuserActiveGauge.add(-1);
  }
}

export function setup() {
  console.log("🚀 ENHANCED K6 Video Streaming Load Test - HIGH SCALE");
  console.log("📊 High-Scale Streaming Configuration:");
  console.log(`- Peak Users: 500 CCU (sustained for 10 minutes)`);
  console.log(`- Segment Duration: ${SEGMENT_DURATION_SECONDS}s`);
  console.log(
    `- Streaming Duration: ${STREAMING_DURATION_SECONDS}s (5 minutes)`
  );
  console.log(
    `- Segments per Session: ${TOTAL_SEGMENTS_NEEDED} (~53 segments)`
  );
  console.log(`- Total Test Duration: 30 minutes`);
  console.log(`- Expected Load: ~50,000 requests/minute at peak`);
  console.log("");

  return {
    testStartTime: new Date().toISOString(),
    testConfig: {
      maxCCU: 500, // Thay đổi từ 100
      segmentDuration: SEGMENT_DURATION_SECONDS,
      streamingDuration: STREAMING_DURATION_SECONDS,
      totalSegments: TOTAL_SEGMENTS_NEEDED,
      totalDuration: 1800,
    },
  };
}

export function teardown(data) {
  console.log("");
  console.log("✅ Enhanced Video Test Completed");
  console.log("⏰ Started: " + data.testStartTime);
  console.log("⏰ Ended: " + new Date().toISOString());
  console.log(
    `📊 VUser Stats Collected: ${Object.keys(vuserStats).length} users`
  );
  console.log("📊 Enhanced reports generated");
}

// ENHANCED report generation with VUser analytics
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Safe metric extraction - move outside try block for use in catch
  const safeGet = (path, fallback = 0) => {
    try {
      return path || fallback;
    } catch {
      return fallback;
    }
  };

  try {
    const metrics = {
      httpReqs: safeGet(data.metrics.http_reqs?.values.count),
      httpReqDuration: {
        avg: safeGet(data.metrics.http_req_duration?.values.avg),
        p50: safeGet(data.metrics.http_req_duration?.values["p(50)"]),
        p90: safeGet(data.metrics.http_req_duration?.values["p(90)"]),
        p95: safeGet(data.metrics.http_req_duration?.values["p(95)"]),
        p99: safeGet(data.metrics.http_req_duration?.values["p(99)"]),
        max: safeGet(data.metrics.http_req_duration?.values.max),
        min: safeGet(data.metrics.http_req_duration?.values.min),
      },
      httpReqFailed: safeGet(data.metrics.http_req_failed?.values.rate),
      httpReqRate: safeGet(data.metrics.http_reqs?.values.rate),
      dataReceived: safeGet(data.metrics.data_received?.values.count),
      dataReceivedRate: safeGet(data.metrics.data_received?.values.rate),
      checks: safeGet(data.metrics.checks?.values.rate),
      vusMax: safeGet(data.metrics.vus_max?.values.max),
      iterations: safeGet(data.metrics.iterations?.values.count),

      // Enhanced custom metrics
      videoSegments: safeGet(data.metrics.video_segments_loaded?.values.rate),
      audioSegments: safeGet(data.metrics.audio_segments_loaded?.values.rate),
      initSegments: safeGet(data.metrics.init_segments_loaded?.values.rate),
      streamingSessionQuality: safeGet(
        data.metrics.streaming_session_quality?.values.rate
      ),
      segmentSuccessRate: safeGet(
        data.metrics.segment_success_rate?.values.rate
      ),
      vuserRequests: safeGet(data.metrics.vuser_requests?.values.count),

      sessionDuration: {
        avg: safeGet(data.metrics.session_duration?.values.avg),
        p50: safeGet(data.metrics.session_duration?.values["p(50)"]),
        p90: safeGet(data.metrics.session_duration?.values["p(90)"]),
        p95: safeGet(data.metrics.session_duration?.values["p(95)"]),
        p99: safeGet(data.metrics.session_duration?.values["p(99)"]),
      },

      segmentLoadTime: {
        avg: safeGet(data.metrics.segment_load_time?.values.avg),
        p50: safeGet(data.metrics.segment_load_time?.values["p(50)"]),
        p90: safeGet(data.metrics.segment_load_time?.values["p(90)"]),
        p95: safeGet(data.metrics.segment_load_time?.values["p(95)"]),
        p99: safeGet(data.metrics.segment_load_time?.values["p(99)"]),
      },
    };

    const successRate = ((1 - metrics.httpReqFailed) * 100).toFixed(1);
    const failureRate = (metrics.httpReqFailed * 100).toFixed(1);
    const checksPassed = (metrics.checks * 100).toFixed(1);
    const dataMB = (metrics.dataReceived / 1024 / 1024).toFixed(2);

    // Performance grading with enhanced criteria
    function getGrade(
      successRate,
      p95ResponseTime,
      p99ResponseTime,
      segmentSuccessRate
    ) {
      const success = parseFloat(successRate);
      const p95 = p95ResponseTime / 1000;
      const p99 = p99ResponseTime / 1000;
      const segmentSuccess = segmentSuccessRate * 100;

      // More lenient grading for 500 CCU load
      if (success >= 85 && p95 <= 15 && p99 <= 25 && segmentSuccess >= 80)
        return {
          grade: "A+",
          description: "Excellent High-Scale Performance",
          color: "success",
        };
      if (success >= 75 && p95 <= 20 && p99 <= 35 && segmentSuccess >= 70)
        return {
          grade: "A",
          description: "Very Good High-Scale Performance",
          color: "success",
        };
      if (success >= 65 && p95 <= 30 && p99 <= 45 && segmentSuccess >= 60)
        return {
          grade: "B",
          description: "Good High-Scale Performance",
          color: "warning",
        };
      if (success >= 55 && p95 <= 40 && p99 <= 60 && segmentSuccess >= 50)
        return {
          grade: "C",
          description: "Acceptable High-Scale Performance",
          color: "warning",
        };
      return {
        grade: "D",
        description: "Needs High-Scale Optimization",
        color: "error",
      };
    }

    const grade = getGrade(
      successRate,
      metrics.httpReqDuration.p95,
      metrics.httpReqDuration.p99,
      metrics.segmentSuccessRate
    );

    // Enhanced HTML report with detailed VUser analytics
    const htmlReport = `<!DOCTYPE html>
<html>
<head>
    <title>Enhanced K6 Video Streaming Report</title>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            line-height: 1.6;
        }
        .container { 
            max-width: 1400px; 
            margin: 0 auto; 
            background: white; 
            box-shadow: 0 20px 60px rgba(0,0,0,0.15); 
            min-height: 100vh;
        }
        
        /* Header Section */
        .header { 
            background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
            color: white; 
            padding: 40px; 
            text-align: center; 
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grain)"/></svg>');
        }
        .header-content { position: relative; z-index: 2; }
        .header h1 { margin: 0; font-size: 2.8em; font-weight: 300; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .header p { margin: 15px 0 5px 0; opacity: 0.95; font-size: 1.1em; }
        .header .timestamp { font-size: 0.9em; opacity: 0.8; margin-top: 20px; }
        
        /* Grade Section */
        .grade { 
            text-align: center; 
            padding: 40px; 
            margin: 0; 
            position: relative;
            overflow: hidden;
        }
        .grade.success { 
            background: linear-gradient(135deg, #27ae60, #2ecc71); 
            color: white;
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2);
        }
        .grade.warning { 
            background: linear-gradient(135deg, #f39c12, #e67e22); 
            color: white;
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2);
        }
        .grade.error { 
            background: linear-gradient(135deg, #e74c3c, #c0392b); 
            color: white;
            box-shadow: inset 0 -4px 8px rgba(0,0,0,0.2);
        }
        .grade h2 { 
            margin: 0; 
            font-size: 2.5em; 
            font-weight: 300; 
            text-shadow: 0 3px 6px rgba(0,0,0,0.3);
            letter-spacing: 2px;
        }
        
        /* Key Stats Grid */
        .key-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 25px;
            padding: 40px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        }
        .stat-card {
            background: white;
            padding: 30px 25px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            border: 1px solid rgba(0,0,0,0.05);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.12);
        }
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3498db, #2ecc71);
        }
        .stat-number {
            font-size: 2.8em;
            font-weight: 700;
            display: block;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .stat-label {
            color: #666;
            font-size: 0.95em;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .success { color: #27ae60 !important; }
        .warning { color: #f39c12 !important; }
        .error { color: #e74c3c !important; }
        
        /* Performance Analytics Section */
        .analytics-section {
            padding: 50px 40px;
            background: white;
        }
        .section-title {
            text-align: center;
            font-size: 2.2em;
            color: #2c3e50;
            margin-bottom: 50px;
            font-weight: 300;
            position: relative;
        }
        .section-title::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 3px;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            border-radius: 2px;
        }
        
        /* Charts Grid */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 35px;
            margin-bottom: 40px;
        }
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border: 1px solid rgba(0,0,0,0.05);
            position: relative;
        }
        .chart-container h3 {
            margin: 0 0 25px 0;
            color: #2c3e50;
            font-size: 1.3em;
            text-align: center;
            font-weight: 600;
        }
        .chart-canvas {
            position: relative;
            height: 320px;
        }
        
        /* Detailed Metrics Grid */
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 30px; 
            padding: 40px;
            background: #f8f9fa;
        }
        .metric-card { 
            background: white; 
            padding: 30px; 
            border-radius: 16px; 
            border-left: 5px solid #3498db;
            box-shadow: 0 8px 25px rgba(0,0,0,0.08);
            transition: transform 0.3s ease;
        }
        .metric-card:hover {
            transform: translateY(-3px);
        }
        .metric-card h3 { 
            margin: 0 0 25px 0; 
            color: #2c3e50; 
            font-size: 1.2em;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .metric-row { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            padding: 12px 0; 
            border-bottom: 1px solid #ecf0f1;
        }
        .metric-row:last-child { border-bottom: none; }
        .metric-label { font-weight: 500; color: #666; }
        .metric-value { 
            font-weight: 700; 
            color: #2c3e50; 
            font-size: 1.1em;
            text-align: right;
        }
        
        /* VUser Analytics */
        .vuser-section {
            background: white;
            padding: 40px;
            margin: 0;
        }
        .vuser-summary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 30px;
            border-radius: 16px;
            margin-bottom: 30px;
            text-align: center;
        }
        .vuser-summary h3 {
            margin: 0 0 15px 0;
            font-size: 1.5em;
        }
        .vuser-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .vuser-stat {
            background: rgba(255,255,255,0.2);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .vuser-stat .number {
            font-size: 2em;
            font-weight: bold;
            display: block;
        }
        
        /* Recommendations */
        .recommendations {
            background: white;
            padding: 40px;
            margin: 0;
            border-top: 1px solid #ecf0f1;
        }
        .recommendations h3 {
            color: #2c3e50;
            margin-bottom: 25px;
            font-size: 1.4em;
        }
        .recommendation-alert {
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            border-left: 5px solid;
            font-weight: 500;
        }
        .recommendations ul {
            line-height: 1.8;
            padding-left: 0;
        }
        .recommendations li {
            margin-bottom: 12px;
            padding-left: 20px;
            position: relative;
        }
        .recommendations li::before {
            content: '▶';
            position: absolute;
            left: 0;
            color: #3498db;
        }
        
        /* Footer */
        .footer { 
            background: linear-gradient(135deg, #2c3e50, #34495e);
            color: white;
            padding: 40px;
            text-align: center;
            margin: 0;
        }
        .footer-content {
            max-width: 800px;
            margin: 0 auto;
        }
        .footer h4 {
            margin: 0 0 15px 0;
            font-size: 1.3em;
            font-weight: 300;
        }
        .footer p {
            margin: 8px 0;
            opacity: 0.9;
            line-height: 1.6;
        }
        .footer .tech-details {
            margin-top: 25px;
            padding-top: 25px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 0.9em;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-content">
                <h1>🎬 Enhanced Video Streaming Analytics - HIGH SCALE</h1>
<p>High-Scale Load Test Report • Peak ${metrics.vusMax} Concurrent Users</p>
<p>Extended Streaming Test • ${TOTAL_SEGMENTS_NEEDED} Segments over ${STREAMING_DURATION_SECONDS}s • 30min Duration</p>
                <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
            </div>
        </div>
        
        <!-- Overall Grade -->
        <div class="grade ${grade.color}">
            <h2>Overall Performance: ${grade.grade}</h2>
            <p style="font-size: 1.2em; margin: 15px 0 0 0; opacity: 0.95;">${
              grade.description
            }</p>
        </div>

        <!-- Key Statistics -->
        <div class="key-stats">
            <div class="stat-card">
                <span class="stat-number">${metrics.httpReqs.toLocaleString()}</span>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-card">
                <span class="stat-number ${
                  parseFloat(successRate) > 90
                    ? "success"
                    : parseFloat(successRate) > 75
                    ? "warning"
                    : "error"
                }">${successRate}%</span>
                <div class="stat-label">Success Rate</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${(
                  metrics.httpReqDuration.p95 / 1000
                ).toFixed(1)}s</span>
                <div class="stat-label">P95 Response Time</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${(
                  metrics.httpReqDuration.p99 / 1000
                ).toFixed(1)}s</span>
                <div class="stat-label">P99 Response Time</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${dataMB}</span>
                <div class="stat-label">Data Transferred (MB)</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${metrics.iterations}</span>
                <div class="stat-label">Streaming Sessions</div>
            </div>
        </div>

        <!-- Performance Analytics -->
        <div class="analytics-section">
            <h2 class="section-title">📊 Performance Analytics</h2>
            
            <div class="charts-grid">
                <!-- Response Time Percentiles -->
                <div class="chart-container">
                    <h3>⏱️ Response Time Distribution</h3>
                    <div class="chart-canvas">
                        <canvas id="responseTimeChart"></canvas>
                    </div>
                </div>

                <!-- Success vs Failure Analysis -->
                <div class="chart-container">
                    <h3>✅ Request Success Analysis</h3>
                    <div class="chart-canvas">
                        <canvas id="successAnalysisChart"></canvas>
                    </div>
                </div>

                <!-- Segment Performance -->
                <div class="chart-container">
                    <h3>🎬 Streaming Segment Quality</h3>
                    <div class="chart-canvas">
                        <canvas id="segmentQualityChart"></canvas>
                    </div>
                </div>

                <!-- VUser Performance -->
                <div class="chart-container">
                    <h3>👥 VUser Performance Metrics</h3>
                    <div class="chart-canvas">
                        <canvas id="vuserPerformanceChart"></canvas>
                    </div>
                </div>

                <!-- Session Duration Analysis -->
                <div class="chart-container">
                    <h3>🕐 Session Duration Analysis</h3>
                    <div class="chart-canvas">
                        <canvas id="sessionDurationChart"></canvas>
                    </div>
                </div>

                <!-- Segment Load Times -->
                <div class="chart-container">
                    <h3>📡 Segment Load Performance</h3>
                    <div class="chart-canvas">
                        <canvas id="segmentLoadChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- VUser Analytics -->
        <div class="vuser-section">
            <div class="vuser-summary">
                <h3>👥 Virtual User Analytics</h3>
                <p>Detailed tracking of individual user performance and behavior patterns</p>
                <div class="vuser-grid">
                    <div class="vuser-stat">
                        <span class="number">${metrics.vusMax}</span>
                        <div>Peak Concurrent Users</div>
                    </div>
                    <div class="vuser-stat">
                        <span class="number">${(
                          metrics.vuserRequests / metrics.vusMax
                        ).toFixed(1)}</span>
                        <div>Avg Requests per User</div>
                    </div>
                    <div class="vuser-stat">
                        <span class="number">${(
                          metrics.sessionDuration.avg / 1000
                        ).toFixed(1)}s</span>
                        <div>Avg Session Duration</div>
                    </div>
                    <div class="vuser-stat">
                        <span class="number">${(
                          metrics.streamingSessionQuality * 100
                        ).toFixed(1)}%</span>
                        <div>Session Quality Score</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <h3>📊 Request Performance</h3>
                <div class="metric-row">
                    <span class="metric-label">Total Requests:</span>
                    <span class="metric-value">${metrics.httpReqs.toLocaleString()}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Success Rate:</span>
                    <span class="metric-value ${
                      parseFloat(successRate) > 90
                        ? "success"
                        : parseFloat(successRate) > 75
                        ? "warning"
                        : "error"
                    }">${successRate}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Failure Rate:</span>
                    <span class="metric-value ${
                      parseFloat(failureRate) < 10
                        ? "success"
                        : parseFloat(failureRate) < 25
                        ? "warning"
                        : "error"
                    }">${failureRate}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Request Rate:</span>
                    <span class="metric-value">${metrics.httpReqRate.toFixed(
                      2
                    )} req/s</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>⏱️ Response Time Analysis</h3>
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
                    <span class="metric-label">P90:</span>
                    <span class="metric-value ${
                      metrics.httpReqDuration.p90 < 8000
                        ? "success"
                        : metrics.httpReqDuration.p90 < 15000
                        ? "warning"
                        : "error"
                    }">${(metrics.httpReqDuration.p90 / 1000).toFixed(
      2
    )}s</span>
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
                    <span class="metric-value ${
                      metrics.httpReqDuration.p99 < 20000
                        ? "success"
                        : metrics.httpReqDuration.p99 < 30000
                        ? "warning"
                        : "error"
                    }">${(metrics.httpReqDuration.p99 / 1000).toFixed(
      2
    )}s</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>🎬 Streaming Quality Metrics</h3>
                <div class="metric-row">
                    <span class="metric-label">Video Segments:</span>
                    <span class="metric-value ${
                      metrics.videoSegments > 0.85
                        ? "success"
                        : metrics.videoSegments > 0.7
                        ? "warning"
                        : "error"
                    }">${(metrics.videoSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Audio Segments:</span>
                    <span class="metric-value ${
                      metrics.audioSegments > 0.85
                        ? "success"
                        : metrics.audioSegments > 0.7
                        ? "warning"
                        : "error"
                    }">${(metrics.audioSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Init Segments:</span>
                    <span class="metric-value ${
                      metrics.initSegments > 0.9
                        ? "success"
                        : metrics.initSegments > 0.8
                        ? "warning"
                        : "error"
                    }">${(metrics.initSegments * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Overall Quality:</span>
                    <span class="metric-value ${
                      metrics.streamingSessionQuality > 0.85
                        ? "success"
                        : metrics.streamingSessionQuality > 0.7
                        ? "warning"
                        : "error"
                    }">${(metrics.streamingSessionQuality * 100).toFixed(
      1
    )}%</span>
                </div>
            </div>

            <div class="metric-card">
                <h3>📈 Session & Throughput</h3>
                <div class="metric-row">
                    <span class="metric-label">Total Sessions:</span>
                    <span class="metric-value">${metrics.iterations}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Avg Session Time:</span>
                    <span class="metric-value">${(
                      metrics.sessionDuration.avg / 1000
                    ).toFixed(1)}s</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Data Transferred:</span>
                    <span class="metric-value">${dataMB} MB</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Throughput:</span>
                    <span class="metric-value">${(
                      metrics.dataReceivedRate / 1024
                    ).toFixed(2)} KB/s</span>
                </div>
            </div>
        </div>

        <!-- Recommendations -->
        <div class="recommendations">
            <h3>💡 Performance Analysis & Recommendations</h3>
            
            <div class="recommendation-alert" style="background: ${
              grade.color === "success"
                ? "#d4edda"
                : grade.color === "warning"
                ? "#fff3cd"
                : "#f8d7da"
            }; border-left-color: ${
      grade.color === "success"
        ? "#27ae60"
        : grade.color === "warning"
        ? "#f39c12"
        : "#e74c3c"
    };">
                <strong>📊 Overall Assessment:</strong> ${
                  grade.grade === "A+" || grade.grade === "A"
                    ? "✅ Excellent performance! Your video streaming platform handles high concurrent loads very well."
                    : grade.grade === "B"
                    ? "⚠️ Good performance with some optimization opportunities identified."
                    : "❌ Performance issues detected. Immediate optimization required for production readiness."
                }
            </div>
            
            <h4 style="color: #2c3e50; margin: 25px 0 15px 0;">🔧 Technical Recommendations:</h4>
            <ul>
                ${
                  parseFloat(successRate) < 85
                    ? `<li><strong>🚨 Critical:</strong> Success rate of ${successRate}% is below acceptable threshold. Investigate server capacity, network infrastructure, and CDN performance.</li>`
                    : ""
                }
                ${
                  metrics.httpReqDuration.p95 > 15000
                    ? `<li><strong>⏱️ Response Time:</strong> P95 response time of ${(
                        metrics.httpReqDuration.p95 / 1000
                      ).toFixed(
                        1
                      )}s is high. Consider implementing edge caching and optimizing video segment delivery.</li>`
                    : ""
                }
                ${
                  metrics.httpReqDuration.p99 > 25000
                    ? `<li><strong>🔥 P99 Latency:</strong> P99 response time of ${(
                        metrics.httpReqDuration.p99 / 1000
                      ).toFixed(
                        1
                      )}s indicates potential issues for worst-case scenarios.</li>`
                    : ""
                }
                ${
                  parseFloat(failureRate) > 15
                    ? `<li><strong>🔧 High Failure Rate:</strong> ${failureRate}% failure rate suggests system stress. Scale infrastructure or implement better load balancing.</li>`
                    : ""
                }
                ${
                  metrics.videoSegments < 0.8
                    ? `<li><strong>🎬 Video Delivery:</strong> Video segment success rate of ${(
                        metrics.videoSegments * 100
                      ).toFixed(
                        1
                      )}% needs improvement. Check video encoding and delivery pipeline.</li>`
                    : ""
                }
                ${
                  metrics.audioSegments < 0.8
                    ? `<li><strong>🔊 Audio Delivery:</strong> Audio segment success rate of ${(
                        metrics.audioSegments * 100
                      ).toFixed(
                        1
                      )}% needs attention. Optimize audio delivery infrastructure.</li>`
                    : ""
                }
                <li><strong>📊 Monitoring:</strong> Implement real-time monitoring for response times, segment delivery rates, and user experience metrics.</li>
                <li><strong>🚀 Scaling:</strong> ${
                  grade.grade === "A+" || grade.grade === "A"
                    ? "Consider testing with higher loads (150-200 CCU) to find system limits."
                    : "Resolve current issues before testing higher concurrent user loads."
                }</li>
                <li><strong>🌐 CDN Optimization:</strong> Ensure global CDN coverage and implement intelligent segment pre-loading for improved user experience.</li>
            </ul>
            
            <h4 style="color: #2c3e50; margin: 25px 0 15px 0;">📈 Performance Insights:</h4>
            <ul>
                <li><strong>📊 Request Distribution:</strong> ${metrics.httpReqs.toLocaleString()} total requests across ${
      metrics.vusMax
    } peak users (${(metrics.vuserRequests / metrics.vusMax).toFixed(
      1
    )} requests per user average)</li>
                <li><strong>🎯 Session Quality:</strong> ${(
                  metrics.streamingSessionQuality * 100
                ).toFixed(
                  1
                )}% of streaming sessions completed successfully with good quality</li>
                <li><strong>⏱️ Response Time Profile:</strong> 50% of requests under ${(
                  metrics.httpReqDuration.p50 / 1000
                ).toFixed(1)}s, 95% under ${(
      metrics.httpReqDuration.p95 / 1000
    ).toFixed(1)}s</li>
                <li><strong>📡 Segment Performance:</strong> Average segment load time: ${(
                  metrics.segmentLoadTime.avg / 1000
                ).toFixed(2)}s (P95: ${(
      metrics.segmentLoadTime.p95 / 1000
    ).toFixed(2)}s)</li>
            </ul>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-content">
                <h4>🎬 Enhanced Video Streaming Load Test Report</h4>
                <p><strong>Test Summary:</strong> ${metrics.httpReqs.toLocaleString()} requests • ${successRate}% success rate • ${dataMB}MB transferred • Peak ${
      metrics.vusMax
    } concurrent users</p>
                <p><strong>Streaming Simulation:</strong> ${TOTAL_SEGMENTS_NEEDED} segments per session • ${STREAMING_DURATION_SECONDS}s duration • Realistic browser-like behavior</p>
                <div class="tech-details">
                    <p><strong>Technical Details:</strong> Enhanced K6 Load Test with VUser Analytics • Generated ${timestamp}</p>
                    <p>Comprehensive performance metrics including P90, P95, P99 response times and individual user tracking</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        console.log('🔄 Initializing Enhanced Performance Charts...');
        
        document.addEventListener('DOMContentLoaded', function() {
            if (typeof Chart === 'undefined') {
                console.error('❌ Chart.js failed to load');
                return;
            }
            
            console.log('✅ Chart.js loaded, creating enhanced visualizations...');
            
            // Chart.js configuration
            Chart.defaults.font.family = "'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif";
            Chart.defaults.font.size = 12;
            Chart.defaults.color = '#666';
            
            // Define chart colors
            const chartColors = {
                primary: '#3498db',
                success: '#27ae60', 
                warning: '#f39c12',
                error: '#e74c3c',
                info: '#9b59b6',
                secondary: '#95a5a6'
            };

            // Pre-calculate colors based on metrics
            const p90Color = ${
              metrics.httpReqDuration.p90 < 8000
                ? '"#27ae60"'
                : metrics.httpReqDuration.p90 < 15000
                ? '"#f39c12"'
                : '"#e74c3c"'
            };
            const p95Color = ${
              metrics.httpReqDuration.p95 < 12000
                ? '"#27ae60"'
                : metrics.httpReqDuration.p95 < 20000
                ? '"#f39c12"'
                : '"#e74c3c"'
            };
            const p99Color = ${
              metrics.httpReqDuration.p99 < 20000
                ? '"#27ae60"'
                : metrics.httpReqDuration.p99 < 30000
                ? '"#f39c12"'
                : '"#e74c3c"'
            };

            try {
                // 1. Enhanced Response Time Distribution
                const responseTimeCtx = document.getElementById('responseTimeChart');
                if (responseTimeCtx) {
                    new Chart(responseTimeCtx, {
                        type: 'bar',
                        data: {
                            labels: ['Avg', 'P50', 'P90', 'P95', 'P99', 'Max'],
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
                                    ).toFixed(2)},
                                    ${(
                                      metrics.httpReqDuration.max / 1000
                                    ).toFixed(2)}
                                ],
                                backgroundColor: [
                                    chartColors.primary,
                                    chartColors.success,
                                    p90Color,
                                    p95Color,
                                    p99Color,
                                    chartColors.secondary
                                ],
                                borderColor: '#2c3e50',
                                borderWidth: 1,
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
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
                                    title: { display: true, text: 'Response Time (seconds)' },
                                    grid: { color: 'rgba(0,0,0,0.1)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }

                // 2. Success Analysis Doughnut
                const successAnalysisCtx = document.getElementById('successAnalysisChart');
                if (successAnalysisCtx) {
                    new Chart(successAnalysisCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Successful Requests', 'Failed Requests'],
                            datasets: [{
                                data: [${parseFloat(successRate)}, ${parseFloat(
      failureRate
    )}],
                                backgroundColor: [chartColors.success, chartColors.error],
                                borderColor: ['#fff', '#fff'],
                                borderWidth: 4,
                                hoverOffset: 8
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: { 
                                        padding: 20, 
                                        usePointStyle: true,
                                        font: { size: 13 }
                                    }
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    callbacks: {
                                        label: function(context) {
                                            return context.label + ': ' + context.parsed + '%';
                                        }
                                    }
                                }
                            }
                        }
                    });
                }

                // 3. Segment Quality Radar
                const segmentQualityCtx = document.getElementById('segmentQualityChart');
                if (segmentQualityCtx) {
                    new Chart(segmentQualityCtx, {
                        type: 'radar',
                        data: {
                            labels: ['Video Segments', 'Audio Segments', 'Init Segments', 'Overall Success', 'Session Quality'],
                            datasets: [{
                                label: 'Success Rate (%)',
                                data: [
                                    ${(metrics.videoSegments * 100).toFixed(1)},
                                    ${(metrics.audioSegments * 100).toFixed(1)},
                                    ${(metrics.initSegments * 100).toFixed(1)},
                                    ${parseFloat(successRate)},
                                    ${(
                                      metrics.streamingSessionQuality * 100
                                    ).toFixed(1)}
                                ],
                                fill: true,
                                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                                borderColor: chartColors.primary,
                                borderWidth: 3,
                                pointBackgroundColor: chartColors.primary,
                                pointBorderColor: '#fff',
                                pointBorderWidth: 3,
                                pointRadius: 6,
                                pointHoverRadius: 8
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                r: {
                                    angleLines: { color: 'rgba(0,0,0,0.1)' },
                                    grid: { color: 'rgba(0,0,0,0.1)' },
                                    pointLabels: { font: { size: 12 } },
                                    suggestedMin: 0,
                                    suggestedMax: 100,
                                    ticks: {
                                        stepSize: 20,
                                        callback: function(value) { 
                                            return value + '%'; 
                                        }
                                    }
                                }
                            },
                            plugins: { 
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                }
                            }
                        }
                    });
                }

                // 4. VUser Performance Bar Chart
                const vuserPerformanceCtx = document.getElementById('vuserPerformanceChart');
                if (vuserPerformanceCtx) {
                    new Chart(vuserPerformanceCtx, {
                        type: 'bar',
                        data: {
                            labels: ['Peak CCU', 'Avg Requests/User', 'Session Quality', 'Data/User (MB)'],
                            datasets: [{
                                label: 'VUser Metrics',
                                data: [
                                    ${metrics.vusMax},
                                    ${(
                                      metrics.vuserRequests / metrics.vusMax
                                    ).toFixed(1)},
                                    ${(
                                      metrics.streamingSessionQuality * 100
                                    ).toFixed(1)},
                                    ${(
                                      metrics.dataReceived /
                                      1024 /
                                      1024 /
                                      metrics.vusMax
                                    ).toFixed(2)}
                                ],
                                backgroundColor: [
                                    chartColors.primary,
                                    chartColors.success,
                                    chartColors.info,
                                    chartColors.warning
                                ],
                                borderColor: '#2c3e50',
                                borderWidth: 1,
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                }
                            },
                            scales: {
                                y: { 
                                    beginAtZero: true,
                                    grid: { color: 'rgba(0,0,0,0.1)' }
                                },
                                x: { 
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }

                // 5. Session Duration Analysis
                const sessionDurationCtx = document.getElementById('sessionDurationChart');
                if (sessionDurationCtx) {
                    new Chart(sessionDurationCtx, {
                        type: 'line',
                        data: {
                            labels: ['Avg', 'P50', 'P90', 'P95', 'P99'],
                            datasets: [{
                                label: 'Session Duration (seconds)',
                                data: [
                                    ${(
                                      metrics.sessionDuration.avg / 1000
                                    ).toFixed(1)},
                                    ${(
                                      metrics.sessionDuration.p50 / 1000
                                    ).toFixed(1)},
                                    ${(
                                      metrics.sessionDuration.p90 / 1000
                                    ).toFixed(1)},
                                    ${(
                                      metrics.sessionDuration.p95 / 1000
                                    ).toFixed(1)},
                                    ${(
                                      metrics.sessionDuration.p99 / 1000
                                    ).toFixed(1)}
                                ],
                                fill: true,
                                backgroundColor: 'rgba(155, 89, 182, 0.3)',
                                borderColor: chartColors.info,
                                borderWidth: 3,
                                pointBackgroundColor: chartColors.info,
                                pointBorderColor: '#fff',
                                pointBorderWidth: 2,
                                pointRadius: 6,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    callbacks: {
                                        label: function(context) {
                                            return 'Duration: ' + context.parsed.y + 's';
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Duration (seconds)' },
                                    grid: { color: 'rgba(0,0,0,0.1)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }

                // 6. Segment Load Performance
                const segmentLoadCtx = document.getElementById('segmentLoadChart');
                if (segmentLoadCtx) {
                    // Pre-calculate segment load colors
                    const segP90Color = ${
                      metrics.segmentLoadTime.p90 < 5000
                        ? '"#27ae60"'
                        : metrics.segmentLoadTime.p90 < 8000
                        ? '"#f39c12"'
                        : '"#e74c3c"'
                    };
                    const segP95Color = ${
                      metrics.segmentLoadTime.p95 < 8000
                        ? '"#27ae60"'
                        : metrics.segmentLoadTime.p95 < 12000
                        ? '"#f39c12"'
                        : '"#e74c3c"'
                    };
                    const segP99Color = ${
                      metrics.segmentLoadTime.p99 < 15000
                        ? '"#27ae60"'
                        : metrics.segmentLoadTime.p99 < 20000
                        ? '"#f39c12"'
                        : '"#e74c3c"'
                    };
                    
                    new Chart(segmentLoadCtx, {
                        type: 'bar',
                        data: {
                            labels: ['Avg Load Time', 'P50', 'P90', 'P95', 'P99'],
                            datasets: [{
                                label: 'Segment Load Time (seconds)',
                                data: [
                                    ${(
                                      metrics.segmentLoadTime.avg / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.segmentLoadTime.p50 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.segmentLoadTime.p90 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.segmentLoadTime.p95 / 1000
                                    ).toFixed(2)},
                                    ${(
                                      metrics.segmentLoadTime.p99 / 1000
                                    ).toFixed(2)}
                                ],
                                backgroundColor: [
                                    chartColors.success,
                                    chartColors.success,
                                    segP90Color,
                                    segP95Color,
                                    segP99Color
                                ],
                                borderColor: '#2c3e50',
                                borderWidth: 1,
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    callbacks: {
                                        label: function(context) {
                                            return 'Load Time: ' + context.parsed.y + 's';
                                        }
                                    }
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    title: { display: true, text: 'Load Time (seconds)' },
                                    grid: { color: 'rgba(0,0,0,0.1)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }
                
                console.log('🎉 ALL ENHANCED CHARTS CREATED SUCCESSFULLY!');
                
            } catch (error) {
                console.error('❌ Error creating enhanced charts:', error);
                console.error('Error details:', error.message, error.stack);
                
                // Show error message in charts section
                const chartsSection = document.querySelector('.charts-section');
                if (chartsSection) {
                    chartsSection.innerHTML = 
                        '<div style="text-align: center; padding: 50px; color: #e74c3c; background: white; border-radius: 12px; margin: 20px;">' +
                        '<h3>⚠️ Chart Rendering Error</h3>' +
                        '<p>Error: ' + error.message + '</p>' +
                        '<p style="font-size: 0.9em; color: #666;">Charts data is available in the detailed metrics below.</p>' +
                        '</div>';
                }
            }
        });
    </script>
</body>
</html>`;

    // Enhanced text summary
    const textReport = `
Enhanced K6 Video Streaming Load Test Report
==========================================
Generated: ${timestamp}

OVERALL PERFORMANCE GRADE: ${grade.grade} (${grade.description})

CORE PERFORMANCE METRICS:
=========================
Total Requests: ${metrics.httpReqs.toLocaleString()}
Success Rate: ${successRate}%
Failure Rate: ${failureRate}%
Request Rate: ${metrics.httpReqRate.toFixed(2)} req/s
Checks Passed: ${checksPassed}%

RESPONSE TIME ANALYSIS:
======================
Average: ${(metrics.httpReqDuration.avg / 1000).toFixed(2)}s
P50 (Median): ${(metrics.httpReqDuration.p50 / 1000).toFixed(2)}s
P90: ${(metrics.httpReqDuration.p90 / 1000).toFixed(2)}s
P95: ${(metrics.httpReqDuration.p95 / 1000).toFixed(2)}s
P99: ${(metrics.httpReqDuration.p99 / 1000).toFixed(2)}s
Max: ${(metrics.httpReqDuration.max / 1000).toFixed(2)}s

STREAMING QUALITY METRICS:
==========================
Video Segments Success: ${(metrics.videoSegments * 100).toFixed(1)}%
Audio Segments Success: ${(metrics.audioSegments * 100).toFixed(1)}%
Init Segments Success: ${(metrics.initSegments * 100).toFixed(1)}%
Overall Session Quality: ${(metrics.streamingSessionQuality * 100).toFixed(1)}%
Segment Success Rate: ${(metrics.segmentSuccessRate * 100).toFixed(1)}%

VUSER ANALYTICS:
===============
Peak Concurrent Users: ${metrics.vusMax}
Total VUser Requests: ${metrics.vuserRequests.toLocaleString()}
Average Requests per User: ${(metrics.vuserRequests / metrics.vusMax).toFixed(
      1
    )}
Average Session Duration: ${(metrics.sessionDuration.avg / 1000).toFixed(1)}s

SESSION PERFORMANCE:
===================
Total Sessions: ${metrics.iterations}
Session Duration P50: ${(metrics.sessionDuration.p50 / 1000).toFixed(1)}s
Session Duration P95: ${(metrics.sessionDuration.p95 / 1000).toFixed(1)}s
Session Duration P99: ${(metrics.sessionDuration.p99 / 1000).toFixed(1)}s

SEGMENT LOAD PERFORMANCE:
========================
Avg Segment Load Time: ${(metrics.segmentLoadTime.avg / 1000).toFixed(2)}s
Segment Load P90: ${(metrics.segmentLoadTime.p90 / 1000).toFixed(2)}s
Segment Load P95: ${(metrics.segmentLoadTime.p95 / 1000).toFixed(2)}s
Segment Load P99: ${(metrics.segmentLoadTime.p99 / 1000).toFixed(2)}s

DATA TRANSFER METRICS:
=====================
Total Data Received: ${dataMB} MB
Throughput: ${(metrics.dataReceivedRate / 1024).toFixed(2)} KB/s
Data per User: ${(metrics.dataReceived / 1024 / 1024 / metrics.vusMax).toFixed(
      2
    )} MB

STREAMING SIMULATION DETAILS:
============================
Segment Duration: ${SEGMENT_DURATION_SECONDS}s per segment
Total Segments per Session: ${TOTAL_SEGMENTS_NEEDED}
Streaming Duration per Session: ${STREAMING_DURATION_SECONDS}s
Realistic Browser Simulation: ✅ Enabled

TEST STATUS: Enhanced test completed successfully with comprehensive VUser tracking
`;

    console.log("✅ Enhanced report generation completed with VUser analytics");

    return {
      "enhanced-summary.html": htmlReport,
      "enhanced-summary.txt": textReport,
      stdout: textSummary(data, { indent: " ", enableColors: true }),
    };
  } catch (error) {
    console.error("❌ Enhanced report generation error:", error.message);
    console.error("Error stack:", error.stack);

    // Fallback report generation with minimal functionality
    try {
      const basicMetrics = {
        httpReqs: safeGet(data.metrics.http_reqs?.values.count, 0),
        successRate: (
          (1 - safeGet(data.metrics.http_req_failed?.values.rate, 1)) *
          100
        ).toFixed(1),
        p95ResponseTime: (
          safeGet(data.metrics.http_req_duration?.values["p(95)"], 0) / 1000
        ).toFixed(2),
        dataMB: (
          safeGet(data.metrics.data_received?.values.count, 0) /
          1024 /
          1024
        ).toFixed(2),
        vusMax: safeGet(data.metrics.vus_max?.values.max, 0),
      };

      const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
    <title>K6 Test Report (Fallback)</title>
    <style>
        body { font-family: sans-serif; padding: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .success { color: #27ae60; } .warning { color: #f39c12; } .error { color: #e74c3c; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 K6 Video Streaming Test Report</h1>
            <p>Fallback report generated due to chart rendering issue</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <h2>📊 Key Metrics</h2>
        <div class="metric">
            <span>Total Requests:</span>
            <strong>${basicMetrics.httpReqs.toLocaleString()}</strong>
        </div>
        <div class="metric">
            <span>Success Rate:</span>
            <strong class="${
              parseFloat(basicMetrics.successRate) > 85
                ? "success"
                : parseFloat(basicMetrics.successRate) > 70
                ? "warning"
                : "error"
            }">${basicMetrics.successRate}%</strong>
        </div>
        <div class="metric">
            <span>P95 Response Time:</span>
            <strong>${basicMetrics.p95ResponseTime}s</strong>
        </div>
        <div class="metric">
            <span>Data Transferred:</span>
            <strong>${basicMetrics.dataMB} MB</strong>
        </div>
        <div class="metric">
            <span>Peak Concurrent Users:</span>
            <strong>${basicMetrics.vusMax}</strong>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-left: 4px solid #f39c12; border-radius: 4px;">
            <h3>⚠️ Report Generation Notice</h3>
            <p>Enhanced charts could not be rendered due to: <code>${
              error.message
            }</code></p>
            <p>Raw metrics are available in the text summary.</p>
        </div>
        
        <div style="margin-top: 30px; font-size: 0.9em; color: #666; text-align: center;">
            Generated by Enhanced K6 Load Test • ${timestamp}
        </div>
    </div>
</body>
</html>`;

      return {
        "100ccus-summary.html": fallbackHtml,
        "enhanced-summary.txt":
          typeof textReport !== "undefined"
            ? textReport
            : `
Basic K6 Test Summary
====================
Generated: ${timestamp}
Error during full report generation: ${error.message}

Total Requests: ${basicMetrics.httpReqs.toLocaleString()}
Success Rate: ${basicMetrics.successRate}%
P95 Response Time: ${basicMetrics.p95ResponseTime}s
Data Transferred: ${basicMetrics.dataMB} MB
Peak CCU: ${basicMetrics.vusMax}
`,
        "error-debug.txt": `
Enhanced K6 Report Generation Debug Info
=======================================
Error: ${error.message}
Stack: ${error.stack}
Timestamp: ${timestamp}

Available Metrics Keys:
${Object.keys(data.metrics || {}).join(", ")}

Raw Data Sample:
${JSON.stringify(data.metrics?.http_reqs?.values || {}, null, 2)}
`,
        stdout: textSummary(data, { indent: " ", enableColors: true }),
      };
    } catch (fallbackError) {
      console.error("❌ Even fallback report failed:", fallbackError.message);

      return {
        "critical-error-report.txt": `
K6 Test Report - Critical Error
==============================
Primary Error: ${error.message}
Fallback Error: ${fallbackError.message}
Timestamp: ${timestamp}

Test completed but report generation failed completely.
Please check JavaScript syntax and Chart.js availability.

${textSummary(data, { indent: " ", enableColors: false })}
`,
        stdout: textSummary(data, { indent: " ", enableColors: true }),
      };
    }
  }
}
