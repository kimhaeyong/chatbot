import { useMemo, useState } from "react";

const WEIGHTS_CONFIG = {
  walk: 4.0,
  transfers: 9.0,
  stairsRisk: 12.0,
  weatherPenalty: 6.0,
};

const API_SPEC = `openapi: 3.0.0
info:
  title: Carrier-Free Travel Decision Miniapp API
  version: 0.1.0
paths:
  /route/compare:
    post:
      summary: Generate 3 route options for decision support
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RouteRequest'
      responses:
        '200':
          description: List of 3 route options
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/RouteOption'
  /report:
    post:
      summary: Generate PDF report for a selected route
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                route_id:
                  type: string
      responses:
        '200':
          description: Report link
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Report'
components:
  schemas:
    RouteRequest:
      type: object
      properties:
        origin: { type: string }
        destination: { type: string }
        waypoints:
          type: array
          items: { type: string }
        preferences:
          type: object
          additionalProperties: { type: boolean }
    RouteOption:
      type: object
      properties:
        route_id: { type: string }
        name: { type: string }
        theme: { type: string }
        time_min: { type: integer }
        walk_distance_km: { type: number }
        transfers: { type: integer }
        stairs_risk: { type: number }
        comfort_score: { type: number }
        pain_factors:
          type: array
          items: { type: string }
    Report:
      type: object
      properties:
        report_id: { type: string }
        created_at: { type: string }
        summary: { type: string }
        pdf_url: { type: string }`;

const pages = [
  "LanguageSelect",
  "RouteInput",
  "RouteCompare",
  "MapView",
  "ReportView",
  "MyLog",
  "API",
];

const getText = (language, korean, english) =>
  language === "English" ? `${english}\n${korean}` : korean;

const computeComfortScore = (walkDistance, transfers, stairsRisk, weatherPenalty, weights) => {
  const score =
    100 -
    (weights.walk * walkDistance +
      weights.transfers * transfers +
      weights.stairsRisk * stairsRisk +
      weights.weatherPenalty * weatherPenalty);
  return Math.max(0, Math.round(score * 10) / 10);
};

const mockRouteOptions = (weights) => {
  const baseRoutes = [
    {
      name: "A추천",
      theme: "가장 편안한 선택",
      time_min: 38,
      walk_distance_km: 1.2,
      transfers: 1,
      stairs_risk: 1.5,
      weather_penalty: 0.8,
      pain_factors: ["환승 시 엘리베이터 혼잡", "지하 연결 통로 혼잡", "마지막 5분 도보"],
      barrier_hints: [
        { segment: "환승역 2층", warning: "엘리베이터 대기 6~8분 예상" },
        { segment: "B구간 지하", warning: "습기로 바닥 미끄럼" },
      ],
      polyline: [
        { lat: 37.5665, lon: 126.978 },
        { lat: 37.5651, lon: 126.9822 },
        { lat: 37.5634, lon: 126.9901 },
      ],
    },
    {
      name: "B균형",
      theme: "시간과 편안함 균형",
      time_min: 33,
      walk_distance_km: 1.7,
      transfers: 1,
      stairs_risk: 2.3,
      weather_penalty: 1.0,
      pain_factors: ["중간 경사로", "지상 보행 8분", "혼잡한 버스 구간"],
      barrier_hints: [
        { segment: "지상 구간", warning: "횡단보도 2회" },
        { segment: "버스 2정거장", warning: "혼잡도 높음" },
      ],
      polyline: [
        { lat: 37.5665, lon: 126.978 },
        { lat: 37.5683, lon: 126.9855 },
        { lat: 37.5701, lon: 126.9932 },
      ],
    },
    {
      name: "C관광",
      theme: "관광 동선 포함",
      time_min: 45,
      walk_distance_km: 2.4,
      transfers: 2,
      stairs_risk: 3.2,
      weather_penalty: 1.2,
      pain_factors: ["관광지 계단", "환승 2회", "도보 15분"],
      barrier_hints: [
        { segment: "전망대 구간", warning: "계단 2회" },
        { segment: "공원 입구", warning: "자갈길" },
      ],
      polyline: [
        { lat: 37.5665, lon: 126.978 },
        { lat: 37.5712, lon: 126.9818 },
        { lat: 37.5749, lon: 126.9885 },
      ],
    },
  ];

  return baseRoutes.map((route, index) => ({
    route_id: `route-${index + 1}`,
    ...route,
    comfort_score: computeComfortScore(
      route.walk_distance_km,
      route.transfers,
      route.stairs_risk,
      route.weather_penalty,
      weights
    ),
  }));
};

const formatDate = () => new Date().toISOString().slice(0, 16).replace("T", " ");

const MiniMap = ({ polyline }) => {
  const padding = 20;
  const width = 520;
  const height = 240;
  const lats = polyline.map((p) => p.lat);
  const lons = polyline.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const scaleX = (width - padding * 2) / (maxLon - minLon || 1);
  const scaleY = (height - padding * 2) / (maxLat - minLat || 1);
  const points = polyline
    .map((p) => {
      const x = padding + (p.lon - minLon) * scaleX;
      const y = height - padding - (p.lat - minLat) * scaleY;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="map" viewBox={`0 0 ${width} ${height}`} aria-label="route map">
      <rect x="0" y="0" width={width} height={height} rx="16" />
      <polyline points={points} />
      {polyline.map((p, idx) => {
        const x = padding + (p.lon - minLon) * scaleX;
        const y = height - padding - (p.lat - minLat) * scaleY;
        return <circle key={idx} cx={x} cy={y} r="6" />;
      })}
    </svg>
  );
};

export default function App() {
  const [language, setLanguage] = useState("Korean");
  const [page, setPage] = useState("LanguageSelect");
  const [routeRequest, setRouteRequest] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [report, setReport] = useState(null);
  const [consent, setConsent] = useState(false);
  const [logs, setLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [fatigueFeedback, setFatigueFeedback] = useState([]);

  const selectedRoute = useMemo(
    () => routeOptions.find((option) => option.route_id === selectedRouteId),
    [routeOptions, selectedRouteId]
  );

  const addLogEntry = (action, payload) => {
    if (!consent) return;
    setLogs((prev) => [
      ...prev,
      {
        time: formatDate(),
        action,
        payload,
      },
    ]);
  };

  const handleCompare = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const waypoints = [formData.get("waypoint1"), formData.get("waypoint2")].filter(Boolean);
    const request = {
      origin: formData.get("origin"),
      destination: formData.get("destination"),
      waypoints,
      preferences: {
        walk_min: formData.get("walk_min") === "on",
        transfer_min: formData.get("transfer_min") === "on",
        stairs_avoid: formData.get("stairs_avoid") === "on",
        indoor_focus: formData.get("indoor_focus") === "on",
        rest_included: formData.get("rest_included") === "on",
      },
    };
    setRouteRequest(request);
    setRouteOptions(mockRouteOptions(WEIGHTS_CONFIG));
    setPage("RouteCompare");
    addLogEntry("route_request", `${request.origin} → ${request.destination}`);
  };

  const handleSelectRoute = (option) => {
    setSelectedRouteId(option.route_id);
    setPage("MapView");
    addLogEntry("route_selected", option.name);
  };

  const handleGenerateReport = () => {
    if (!selectedRoute) return;
    const newReport = {
      report_id: `report-${selectedRoute.route_id}`,
      created_at: formatDate(),
      summary: `${selectedRoute.name} 루트 요약 리포트`,
      pdf_url: `https://mocked-report.service/${selectedRoute.route_id}.pdf`,
    };
    setReport(newReport);
    addLogEntry("report_generated", newReport.report_id);
  };

  const handleSaveFeedback = (value) => {
    setFatigueFeedback((prev) => [...prev, { time: formatDate(), value }]);
    addLogEntry("fatigue_feedback", value);
  };

  const handleAddFavorite = () => {
    if (!selectedRouteId || favorites.includes(selectedRouteId)) return;
    setFavorites((prev) => [...prev, selectedRouteId]);
    addLogEntry("favorite_added", selectedRouteId);
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>🧳 캐리어 없는 편한 여행 의사결정 미니앱</h1>
          <p>
            {getText(
              language,
              "예약 없이 이동 경로를 비교하고, 편안함 중심으로 선택을 돕습니다.",
              "Compare routes without booking and decide based on comfort."
            )}
          </p>
        </div>
        <div className="language-pill">
          <span>Language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="Korean">Korean</option>
            <option value="English">English</option>
          </select>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <h2>화면 이동</h2>
          <ul>
            {pages.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={page === item ? "active" : ""}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
          <div className="weights">
            <h3>Comfort Score 가중치</h3>
            <ul>
              {Object.entries(WEIGHTS_CONFIG).map(([key, value]) => (
                <li key={key}>
                  <span>{key}</span>
                  <span>{value}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="content">
          {page === "LanguageSelect" && (
            <section className="panel">
              <h2>1) LanguageSelect</h2>
              <p>언어를 선택하세요 / Choose a language</p>
              <div className="card">
                <label>
                  <input
                    type="radio"
                    name="language"
                    value="Korean"
                    checked={language === "Korean"}
                    onChange={() => setLanguage("Korean")}
                  />
                  Korean
                </label>
                <label>
                  <input
                    type="radio"
                    name="language"
                    value="English"
                    checked={language === "English"}
                    onChange={() => setLanguage("English")}
                  />
                  English (with Korean subtitle)
                </label>
                <button type="button" onClick={() => setPage("RouteInput")}
                  className="primary">
                  다음으로 / Continue
                </button>
              </div>
            </section>
          )}

          {page === "RouteInput" && (
            <section className="panel">
              <h2>2) RouteInput</h2>
              <p>
                {getText(
                  language,
                  "출발지와 도착지를 입력하고 선호 옵션을 켜주세요.",
                  "Enter origin/destination and toggle your preferences."
                )}
              </p>
              <form className="card" onSubmit={handleCompare}>
                <div className="grid">
                  <label>
                    출발지
                    <input name="origin" defaultValue="서울역" required />
                  </label>
                  <label>
                    도착지
                    <input name="destination" defaultValue="광화문" required />
                  </label>
                </div>
                <div className="grid">
                  <label>
                    경유지 1 (선택)
                    <input name="waypoint1" />
                  </label>
                  <label>
                    경유지 2 (선택)
                    <input name="waypoint2" />
                  </label>
                </div>
                <div className="toggle-group">
                  <h3>선호 토글</h3>
                  <label>
                    <input type="checkbox" name="walk_min" defaultChecked />
                    걷기 최소
                  </label>
                  <label>
                    <input type="checkbox" name="transfer_min" />
                    환승 최소
                  </label>
                  <label>
                    <input type="checkbox" name="stairs_avoid" defaultChecked />
                    계단 회피
                  </label>
                  <label>
                    <input type="checkbox" name="indoor_focus" defaultChecked />
                    실내 중심
                  </label>
                  <label>
                    <input type="checkbox" name="rest_included" defaultChecked />
                    휴식 포함
                  </label>
                </div>
                <button type="submit" className="primary">
                  3안 비교 생성
                </button>
              </form>
            </section>
          )}

          {page === "RouteCompare" && (
            <section className="panel">
              <h2>3) RouteCompare</h2>
              {!routeOptions.length ? (
                <p>먼저 RouteInput에서 비교 요청을 생성해 주세요.</p>
              ) : (
                <>
                  <p>
                    {getText(
                      language,
                      "아래 3개 카드에서 가장 편안한 선택을 골라주세요.",
                      "Pick the most comfortable option from the three cards below."
                    )}
                  </p>
                  <div className="card-grid">
                    {routeOptions.map((option) => (
                      <div className="card" key={option.route_id}>
                        <div className="card-header">
                          <h3>{option.name}</h3>
                          <span className="chip">{option.theme}</span>
                        </div>
                        <ul>
                          <li>time: {option.time_min}분</li>
                          <li>walk_distance: {option.walk_distance_km}km</li>
                          <li>transfers: {option.transfers}회</li>
                          <li>stairs_risk: {option.stairs_risk}</li>
                          <li>comfort_score: {option.comfort_score}</li>
                        </ul>
                        <div className="divider" />
                        <strong>pain_factors top3</strong>
                        <ol>
                          {option.pain_factors.map((factor) => (
                            <li key={factor}>{factor}</li>
                          ))}
                        </ol>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => handleSelectRoute(option)}
                        >
                          {option.name} 선택
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {page === "MapView" && (
            <section className="panel">
              <h2>4) MapView</h2>
              {!selectedRoute ? (
                <p>RouteCompare에서 먼저 루트를 선택해 주세요.</p>
              ) : (
                <>
                  <p>
                    {getText(
                      language,
                      "선택한 루트의 구간별 주의 사항을 확인하세요.",
                      "Review segment-level cautions for your selected route."
                    )}
                  </p>
                  <div className="card">
                    <MiniMap polyline={selectedRoute.polyline} />
                    <div className="badge-list">
                      {selectedRoute.barrier_hints.map((hint) => (
                        <span key={hint.segment} className="badge">
                          {hint.segment}: {hint.warning}
                        </span>
                      ))}
                    </div>
                    <button type="button" className="primary" onClick={() => setPage("ReportView")}
                    >
                      리포트로 이동
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {page === "ReportView" && (
            <section className="panel">
              <h2>5) ReportView</h2>
              {!selectedRoute ? (
                <p>먼저 MapView에서 루트를 선택해 주세요.</p>
              ) : (
                <>
                  <p>
                    {getText(
                      language,
                      "선택한 경로를 요약하고 PDF로 저장합니다.",
                      "Summarize the chosen route and export as PDF."
                    )}
                  </p>
                  <div className="card">
                    <h3>요약 카드</h3>
                    <p>
                      <strong>{selectedRoute.name}</strong> · {selectedRoute.theme}
                    </p>
                    <p>
                      총 소요: {selectedRoute.time_min}분 | 걷기: {selectedRoute.walk_distance_km}km
                      | 환승: {selectedRoute.transfers}회
                    </p>
                    <p>comfort_score: {selectedRoute.comfort_score}</p>
                  </div>
                  <button type="button" className="primary" onClick={handleGenerateReport}
                  >
                    PDF 리포트 생성
                  </button>
                  {report && (
                    <div className="card success">
                      <p>서버에서 PDF를 생성했습니다. 링크로 확인하세요.</p>
                      <a href={report.pdf_url} target="_blank" rel="noreferrer">
                        PDF 보기
                      </a>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {page === "MyLog" && (
            <section className="panel">
              <h2>6) MyLog</h2>
              <p>
                {getText(
                  language,
                  "동의한 경우에만 사용 기록과 즐겨찾기를 저장합니다.",
                  "We only store logs and favorites with your consent."
                )}
              </p>
              <div className="card">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  사용 기록 저장에 동의합니다
                </label>
                <div className="divider" />
                <h3>피로 피드백</h3>
                <div className="chip-group">
                  <button type="button" onClick={() => handleSaveFeedback("힘들었음")}
                  >
                    힘들었음
                  </button>
                  <button type="button" onClick={() => handleSaveFeedback("괜찮았음")}
                  >
                    괜찮았음
                  </button>
                </div>
              </div>
              {consent && (
                <div className="card">
                  <h3>사용 기록</h3>
                  {logs.length ? (
                    <ul className="log-list">
                      {logs.map((log, index) => (
                        <li key={`${log.time}-${index}`}>
                          <strong>{log.time}</strong> · {log.action} · {log.payload}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>아직 기록된 내역이 없습니다.</p>
                  )}
                  <div className="divider" />
                  <h3>즐겨찾기</h3>
                  <button type="button" onClick={handleAddFavorite}
                    className="secondary">
                    선택한 루트를 즐겨찾기에 추가
                  </button>
                  {favorites.length ? (
                    <ul className="chip-list">
                      {favorites.map((fav) => (
                        <li key={fav}>{fav}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>즐겨찾기에 등록된 루트가 없습니다.</p>
                  )}
                  {fatigueFeedback.length > 0 && (
                    <>
                      <div className="divider" />
                      <h3>피로 피드백 기록</h3>
                      <ul className="log-list">
                        {fatigueFeedback.map((entry, index) => (
                          <li key={`${entry.time}-${index}`}>
                            <strong>{entry.time}</strong> · {entry.value}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {page === "API" && (
            <section className="panel">
              <h2>API 인터페이스 정의</h2>
              <pre className="code-block">{API_SPEC}</pre>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
