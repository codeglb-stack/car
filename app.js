(function () {
  const API_BASE_URL = window.APP_CONFIG?.API_BASE_URL || "";
  const STORAGE_KEY = "commute_bus_routes_v2";

  const DEFAULT_STATE = {
    view: "home",
    loading: false,
    error: "",
    emptyMessage: "",
    data: null,
    routes: [],
    activeId: "",
    form: null
  };

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  let state = { ...DEFAULT_STATE, ...loadStoredState() };
  let toastTimer = 0;
  let pullStartY = 0;
  let pullStartedAtTop = false;

  function icon(name, className = "icon") {
    const icons = {
      settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 0 1-2.98 2.98l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66v.12a2.1 2.1 0 0 1-4.2 0v-.12A1.8 1.8 0 0 0 8.4 19.6a1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 0 1-2.98-2.98l.04-.04A1.8 1.8 0 0 0 3.8 15a1.8 1.8 0 0 0-1.66-1.1H2a2.1 2.1 0 0 1 0-4.2h.14A1.8 1.8 0 0 0 3.8 8.6a1.8 1.8 0 0 0-.36-1.98L3.4 6.58A2.1 2.1 0 0 1 6.38 3.6l.04.04A1.8 1.8 0 0 0 8.4 4a1.8 1.8 0 0 0 1.1-1.66V2.2a2.1 2.1 0 0 1 4.2 0v.14A1.8 1.8 0 0 0 14.8 4a1.8 1.8 0 0 0 1.98-.36l.04-.04A2.1 2.1 0 0 1 19.8 6.58l-.04.04A1.8 1.8 0 0 0 19.4 8.6a1.8 1.8 0 0 0 1.66 1.1h.14a2.1 2.1 0 0 1 0 4.2h-.14A1.8 1.8 0 0 0 19.4 15Z"/>',
      back: '<path d="m15 18-6-6 6-6"/>',
      briefcase: '<path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><path d="M4 7h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"/><path d="M4 12h16"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
      bus: '<path d="M6 17h12M6 17V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v11M8 21h.01M16 21h.01M8 8h8M8 13h8"/><path d="M6 17v2M18 17v2"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
      refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.5 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z"/>'
    };
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }

  function uid() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadStoredState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        routes: Array.isArray(stored.routes) ? stored.routes : [],
        activeId: stored.activeId || ""
      };
    } catch {
      return { routes: [], activeId: "" };
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        routes: state.routes,
        activeId: state.activeId
      })
    );
  }

  function getRoutes() {
    return state.routes || [];
  }

  function getActiveRoute() {
    const routes = getRoutes();
    if (!routes.length) return null;
    return routes.find((route) => route.id === state.activeId) || routes[0];
  }

  function directionLabel(direction, terminal = "") {
    return terminal ? `开往 ${terminal}` : `方向 ${Number(direction) === 2 ? "2" : "1"}`;
  }

  function terminalForDirection(route, direction = route?.direction) {
    if (!route) return "";
    const key = String(Number(direction) === 2 ? 2 : 1);
    return route.terminals?.[key] || (Number(route.direction) === Number(direction) ? route.terminal || "" : "");
  }

  function routeDisplayName(route, fallback) {
    if (!route) return fallback;
    const station = route.station || fallback;
    const note = route.note ? ` · ${route.note}` : "";
    return `${station} · ${directionLabel(route.direction, terminalForDirection(route))}${note}`;
  }

  function setState(patch) {
    state = { ...state, ...patch };
    render();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function topbar(title, options = {}) {
    const left = options.back
      ? `<button class="icon-button" data-action="back" aria-label="返回">${icon("back")}</button>`
      : "<span></span>";
    const right = options.settings
      ? `<button class="icon-button" data-action="settings" aria-label="路线预设">${icon("settings")}</button>`
      : options.refresh
        ? `<button class="icon-button" data-action="refresh" aria-label="刷新">${icon("refresh")}</button>`
        : "<span></span>";

    return `
      <header class="topbar">
        ${left}
        <h1 class="title">${escapeHtml(title)}</h1>
        ${right}
      </header>
    `;
  }

  function render() {
    if (state.view === "settings") {
      app.innerHTML = renderSettings();
      return;
    }

    if (state.view === "form") {
      app.innerHTML = renderForm();
      bindFormValues();
      return;
    }

    if (state.view === "detail") {
      app.innerHTML = renderDetail();
      return;
    }

    app.innerHTML = renderHome();
  }

  function renderHome() {
    const routes = getRoutes();
    if (!routes.length) {
      return `
        <section class="page">
          ${topbar("通勤助手", { settings: true })}
          <div class="state-panel">
            <div class="state-inner">
              <div class="state-icon">${icon("bus")}</div>
              <h2 class="state-title">还没有通勤线路</h2>
              <p class="state-text">添加站点和线路后，就能查看实时到站</p>
              <button class="primary-button" data-action="settings">添加线路</button>
            </div>
          </div>
        </section>
      `;
    }

    return `
      <section class="page">
        ${topbar("通勤助手", { settings: true })}
        <div class="home-head">
          <p class="home-kicker">常用线路</p>
          <button class="secondary-button" data-action="settings">管理</button>
        </div>
        ${renderRouteCards()}
      </section>
    `;
  }

  function renderRouteCards() {
    const routes = getRoutes();
    return `
      <div class="home-route-list" aria-label="线路切换">
        ${routes
          .map((route) => {
            return `
              <button class="home-route-card" data-action="activate-route" data-id="${route.id}">
                <span class="home-route-name">${escapeHtml(routeDisplayName(route, route.line || route.station))}</span>
                <span class="home-route-sub">${escapeHtml(route.line || "未填写线路")} · ${escapeHtml(route.city || "未填写城市")}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderDetail() {
    const route = getActiveRoute();
    return `
      <section class="page">
        ${topbar(route ? route.station || "实时到站" : "实时到站", { back: true, refresh: true })}
        ${route ? renderDirectionControl(route) : ""}
        ${route ? renderRouteContent(route) : renderNoRoute()}
      </section>
    `;
  }

  function renderDirectionControl(route) {
    return `
      <div class="direction-control" aria-label="方向切换">
        ${[1, 2]
          .map((direction) => {
            const active = Number(route.direction) === direction ? "is-active" : "";
            const terminal = terminalForDirection(route, direction);
            return `<button class="${active}" data-action="change-detail-direction" data-direction="${direction}">${escapeHtml(directionLabel(direction, terminal))}</button>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderRouteContent(route) {
    const meta = `${route.line || "全部线路"} · ${route.station} · ${directionLabel(route.direction, terminalForDirection(route))}`;

    if (state.loading) {
      return `
        <div class="route-meta">${escapeHtml(meta)}</div>
        <div class="state-panel">
          <div class="state-inner">
            <div class="spinner"></div>
            <p class="state-text">正在获取实时到站</p>
          </div>
        </div>
      `;
    }

    if (state.error) {
      return `
        <div class="route-meta">${escapeHtml(meta)}</div>
        <div class="state-panel">
          <div class="state-inner">
            <div class="state-icon">${icon("alert")}</div>
            <h2 class="state-title">暂时无法更新</h2>
            <p class="state-text">${escapeHtml(state.error)}</p>
            <button class="primary-button" data-action="refresh">重新刷新</button>
          </div>
        </div>
      `;
    }

    if (state.emptyMessage) {
      return `
        <div class="route-meta">${escapeHtml(meta)}</div>
        <div class="state-panel">
          <div class="state-inner">
            <div class="state-icon">${icon("bus")}</div>
            <h2 class="state-title">暂无实时车辆</h2>
            <p class="state-text">${escapeHtml(state.emptyMessage)}</p>
            <button class="primary-button" data-action="refresh">重新刷新</button>
          </div>
        </div>
      `;
    }

    if (!state.data) {
      return `
        <div class="route-meta">${escapeHtml(meta)}</div>
        <div class="state-panel">
          <div class="state-inner">
            <div class="state-icon">${icon("bus")}</div>
            <h2 class="state-title">等待实时数据</h2>
            <p class="state-text">轻触刷新获取当前到站信息</p>
            <button class="primary-button" data-action="refresh">刷新</button>
          </div>
        </div>
      `;
    }

    const bus = state.data.bus;
    const minutes = bus.travel_minutes ?? "--";
    const stops = bus.stops_remaining ?? "--";
    const terminal = state.data.line.terminal || terminalForDirection(route) || "";
    const terminalText = directionLabel(route.direction, terminal);
    const followingBuses = Array.isArray(state.data.buses) ? state.data.buses.slice(1, 4) : [];

    return `
      <div class="route-meta">${escapeHtml(state.data.line.line || route.line)} · ${escapeHtml(route.station)} · ${escapeHtml(terminalText)}</div>
      <section class="arrival">
        <div class="arrival-main">
          <span class="prefix">还有</span>
          <span class="number">${escapeHtml(minutes)}</span>
          <span class="unit">分钟</span>
        </div>
        <div class="subline">距当前站 <strong>${escapeHtml(stops)}</strong> 站 · ${escapeHtml(bus.bus_id || bus.status || "实时位置")}</div>
      </section>
      <section class="timeline-wrap" aria-label="公交路线示意图">
        ${renderTimelineSvg(route, state.data)}
      </section>
      ${renderFollowingBuses(followingBuses)}
    `;
  }

  function renderFollowingBuses(buses) {
    if (!buses.length) return "";

    return `
      <section class="following-buses" aria-label="后续车辆">
        <div class="following-head">
          <span>后续车辆</span>
          <span>${buses.length} 辆</span>
        </div>
        <div class="following-list">
          ${buses
            .map((bus) => {
              const minutes = bus.travel_minutes ?? "--";
              const stops = bus.stops_remaining ?? "--";
              const busId = bus.bus_id || bus.status || "车辆";
              return `
                <div class="following-row">
                  <div>
                    <strong>${escapeHtml(minutes)} 分钟</strong>
                    <span>距本站 ${escapeHtml(stops)} 站</span>
                  </div>
                  <em>${escapeHtml(busId)}</em>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function renderNoRoute() {
    return `
      <div class="state-panel">
        <div class="state-inner">
          <div class="state-icon">${icon("bus")}</div>
          <h2 class="state-title">还没有线路</h2>
          <p class="state-text">去路线预设里添加一条线路</p>
          <button class="primary-button" data-action="settings">去设置</button>
        </div>
      </div>
    `;
  }

  function renderTimelineSvg(route, realtime) {
    const bus = realtime.bus || {};
    const stopsRemaining = Number(bus.stops_remaining);
    const hasStops = Number.isFinite(stopsRemaining);
    const safeStops = hasStops ? Math.max(0, Math.min(stopsRemaining, 7)) : 3;
    const lineX = 70;
    const topY = 34;
    const stationY = 218;
    const bottomY = 334;
    const busY = hasStops ? Math.max(topY + 26, stationY - safeStops * 24 - 12) : 118;
    const station = compactText(route.station || "当前站", 11);
    const terminal = compactText(realtime.line.terminal || route.terminal || "终点方向", 12);
    const nearCurrentStation = stationY - busY < 58;
    const stationLabelY1 = nearCurrentStation ? stationY + 34 : stationY - 12;
    const stationLabelY2 = nearCurrentStation ? stationY + 56 : stationY + 12;
    const followingMarkers = layoutFollowingMarkers(realtime.buses || [], bus, lineX, topY, stationY).join("");
    const middleDotCount = Math.min(Math.max(safeStops - 1, 0), 4);
    const middleDots = Array.from({ length: middleDotCount }, (_, index) => {
      const y = busY + ((stationY - busY) / (middleDotCount + 1)) * (index + 1);
      return timelineDot(lineX, y, "small");
    }).join("");

    return `
      <svg class="bus-svg" viewBox="0 0 340 360" role="img" aria-label="车辆位置示意图">
        <defs>
          <filter id="blueGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <line x1="${lineX}" y1="${topY}" x2="${lineX}" y2="${bottomY}" stroke="rgba(255,255,255,.18)" stroke-width="3" stroke-linecap="round"/>
        <line x1="${lineX}" y1="${busY}" x2="${lineX}" y2="${stationY}" stroke="#347cff" stroke-width="4" stroke-linecap="round" filter="url(#blueGlow)"/>
        <line x1="${lineX}" y1="${stationY}" x2="${lineX}" y2="${bottomY}" stroke="rgba(255,255,255,.28)" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 13"/>
        ${timelineDot(lineX, topY, "muted")}
        ${middleDots}
        ${followingMarkers}
        ${timelineDot(lineX, stationY, "active")}
        ${timelineDot(lineX, bottomY, "muted")}
        ${timelineDot(lineX, busY, "primaryBus")}
        ${timelineBusIcon(lineX - 42, busY - 14, 1.15, "#347cff", true)}
        ${timelineText(lineX + 22, stationLabelY1, station, "#f7f9ff", 16, 780)}
        ${timelineText(lineX + 22, stationLabelY2, "当前站", "rgba(247,249,255,.58)", 12, 650)}
        ${timelineText(lineX + 22, bottomY - 10, `开往 ${terminal}`, "rgba(247,249,255,.72)", 13, 700)}
      </svg>
    `;
  }

  function layoutFollowingMarkers(buses, mainBus, lineX, topY, stationY) {
    const markerGap = 26;
    const mainStops = Number(mainBus?.stops_remaining);
    const markers = buses
      .slice(1, 4)
      .map((bus, index) => {
        const stops = Number(bus?.stops_remaining);
        const safeStops = Number.isFinite(stops) ? Math.max(0, Math.min(stops, 7)) : index + 3;
        const rawY = Math.max(topY + 18, stationY - safeStops * 24 - 12);
        return {
          y: rawY,
          isSameStop: Number.isFinite(mainStops) && Number.isFinite(stops) && mainStops === stops
        };
      })
      .sort((a, b) => a.y - b.y);

    return markers.map((marker, index) => {
      const previous = markers[index - 1];
      const y = previous && marker.y - previous.y < markerGap ? previous.y + markerGap : marker.y;
      marker.y = Math.min(stationY - 22, Math.max(topY + 18, y));
      const xOffset = marker.isSameStop ? 18 : 14;
      return `
        <circle cx="${lineX}" cy="${marker.y}" r="4.5" fill="rgba(120,173,255,.95)" stroke="rgba(220,232,255,.55)" stroke-width="1.5"/>
        ${timelineBusIcon(lineX + xOffset, marker.y - 9, 0.78, "rgba(247,249,255,.62)", false)}
      `;
    });
  }

  function timelineBusIcon(x, y, scale, fill, isPrimary) {
    const glow = isPrimary ? ' filter="url(#blueGlow)"' : "";
    const opacity = isPrimary ? "1" : "0.85";
    return `
      <g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}" opacity="${opacity}"${glow}>
        <path d="M2 6.5A3.5 3.5 0 0 1 5.5 3h11A3.5 3.5 0 0 1 20 6.5V15h-2.2a2.8 2.8 0 0 1-5.4 0H9.6a2.8 2.8 0 0 1-5.4 0H2V6.5Zm3.5-1A1.5 1.5 0 0 0 4 7v4h14V7a1.5 1.5 0 0 0-1.5-1.5h-11ZM6.9 16.4A1.1 1.1 0 1 0 6.9 14.2a1.1 1.1 0 0 0 0 2.2Zm8.2 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"/>
      </g>
    `;
  }

  function compactText(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  }

  function timelineDot(x, y, variant) {
    const dots = {
      active: { r: 8, fill: "#347cff", stroke: "#dce8ff", width: 3 },
      primaryBus: { r: 7, fill: "#347cff", stroke: "#dce8ff", width: 3 },
      small: { r: 3.5, fill: "rgba(120,173,255,.85)", stroke: "rgba(220,232,255,.35)", width: 1 },
      muted: { r: 5.5, fill: "rgba(247,249,255,.74)", stroke: "rgba(255,255,255,.2)", width: 1.5 }
    };
    const dot = dots[variant] || dots.muted;
    return `<circle cx="${x}" cy="${y}" r="${dot.r}" fill="${dot.fill}" stroke="${dot.stroke}" stroke-width="${dot.width}"/>`;
  }

  function timelineText(x, y, text, fill, size, weight) {
    return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}">${escapeHtml(text)}</text>`;
  }

  function renderSettings() {
    return `
      <section class="page">
        ${topbar("路线预设", { back: true })}
        ${renderPresetList()}
        <button class="primary-button" data-action="back">保存</button>
      </section>
    `;
  }

  function renderPresetList() {
    const routes = getRoutes();
    return `
      <section class="preset-group">
        <h2 class="section-title">常用线路</h2>
        <div class="preset-list">
          ${
            routes.length
              ? routes.map((route) => renderRouteCard(route)).join("")
              : `<button class="empty-card" data-action="add-route">
                  ${icon("bus")}
                  <span>暂未添加线路</span>
                </button>`
          }
        </div>
        <button class="add-link" data-action="add-route">${icon("plus", "icon")} 添加线路</button>
      </section>
    `;
  }

  function renderRouteCard(route) {
    const directionText = directionLabel(route.direction, terminalForDirection(route));
    return `
      <article class="route-card" data-action="edit-route" data-id="${route.id}">
        <div>
          <div class="route-name">${icon("bus")}<span>${escapeHtml(routeDisplayName(route, "未填写站点"))}</span></div>
          <div class="route-desc">${escapeHtml(route.line || "未填写线路")} · ${escapeHtml(route.city || "未填写城市")} · ${directionText}</div>
        </div>
        <div class="route-actions">
          <button class="icon-button secondary-button" data-action="edit-route" data-id="${route.id}" aria-label="编辑">${icon("edit")}</button>
          <button class="icon-button delete-button" data-action="delete-route" data-id="${route.id}" aria-label="删除">${icon("trash")}</button>
        </div>
      </article>
    `;
  }

  function renderForm() {
    const form = state.form || { route: {} };
    const title = form.route?.id ? "编辑线路" : "添加线路";
    return `
      <section class="page">
        ${topbar(title, { back: true })}
        <form class="form" id="routeForm">
          <div class="field">
            <label for="city">城市名称</label>
            <input id="city" name="city" type="text" autocomplete="address-level2" placeholder="请输入官方城市名，例如 长沙" required />
          </div>
          <div class="field">
            <label for="station">站点名称</label>
            <input id="station" name="station" type="text" placeholder="请输入官方站点名" required />
          </div>
          <div class="field">
            <label for="line">线路名称</label>
            <input id="line" name="line" type="text" placeholder="例如 401 或 401路" required />
          </div>
          <div class="field">
            <label for="note">备注</label>
            <input id="note" name="note" type="text" maxlength="12" placeholder="例如 去公司、回家、早班" />
          </div>
          <button class="primary-button" type="submit">确认保存</button>
        </form>
      </section>
    `;
  }

  function bindFormValues() {
    const formRoute = state.form?.route || {};
    const form = document.getElementById("routeForm");
    if (!form) return;
    form.city.value = formRoute.city || "";
    form.station.value = formRoute.station || "";
    form.line.value = formRoute.line || "";
    form.note.value = formRoute.note || "";
  }

  async function loadRealtime() {
    const route = getActiveRoute();
    if (!route) {
      setState({ data: null, loading: false, error: "", emptyMessage: "" });
      return;
    }

    if (!API_BASE_URL) {
      setState({ data: null, loading: false, error: "请先在 config.js 中配置代理接口地址", emptyMessage: "" });
      return;
    }

    setState({ loading: true, error: "", emptyMessage: "" });

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "query",
          city: route.city,
          station: route.station,
          line: route.line,
          direction: Number(route.direction || 1)
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.code !== 0) {
        throw new Error(payload.msg || `请求失败：${response.status}`);
      }

      const realtime = normalizeRealtime(payload.data, route);
      if (!realtime) {
        setState({ loading: false, data: null, error: "", emptyMessage: "当前线路暂无车辆到站信息" });
        return;
      }

      syncRouteTerminal(route.id, route.direction, realtime.line.terminal);
      setState({ loading: false, data: realtime, error: "", emptyMessage: "" });
    } catch (error) {
      setState({ loading: false, error: error.message || "接口请求失败，请稍后重试", emptyMessage: "" });
    }
  }

  async function preloadRouteDirections(routeId) {
    const route = getRoutes().find((item) => item.id === routeId);
    if (!route || !API_BASE_URL) return;

    const directions = [1, 2].filter((direction) => !terminalForDirection(route, direction));
    if (!directions.length) return;

    const results = await Promise.allSettled(
      directions.map(async (direction) => {
        const response = await fetch(API_BASE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: "line",
            city: route.city,
            line: route.line,
            direction
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.code !== 0) return null;
        return {
          direction,
          terminal: extractTerminal(payload.data)
        };
      })
    );

    const terminals = {};
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value?.terminal) {
        terminals[String(result.value.direction)] = result.value.terminal;
      }
    });

    if (Object.keys(terminals).length) {
      syncRouteTerminals(routeId, terminals);
    }
  }

  function extractTerminal(data) {
    if (!data) return "";
    const direct =
      data.terminal ||
      data.end_station ||
      data.endStation ||
      data.end ||
      data.to ||
      data.direction_name ||
      data.directionName;
    if (direct) return String(direct);

    const lineTerminal = data.line?.terminal || data.lines?.[0]?.terminal;
    if (lineTerminal) return String(lineTerminal);

    const stations = data.stations || data.station_list || data.stationList || data.line?.stations || data.lines?.[0]?.stations;
    if (Array.isArray(stations) && stations.length) {
      const last = stations[stations.length - 1];
      return String(last.name || last.station || last.station_name || last.stationName || last);
    }

    return "";
  }

  function syncRouteTerminals(routeId, terminals) {
    if (!routeId || !terminals || !Object.keys(terminals).length) return;
    let changed = false;

    state.routes = getRoutes().map((item) => {
      if (item.id !== routeId) return item;
      const nextTerminals = { ...(item.terminals || {}), ...terminals };
      const activeKey = String(Number(item.direction) === 2 ? 2 : 1);
      const nextTerminal = nextTerminals[activeKey] || item.terminal || "";
      changed =
        changed ||
        Object.keys(terminals).some((key) => item.terminals?.[key] !== terminals[key]) ||
        item.terminal !== nextTerminal;
      return {
        ...item,
        terminal: nextTerminal,
        terminals: nextTerminals
      };
    });

    if (!changed) return;
    persist();
    render();
  }

  function syncRouteTerminal(routeId, direction, terminal) {
    if (!routeId || !terminal) return;
    const route = getRoutes().find((item) => item.id === routeId);
    const key = String(Number(direction) === 2 ? 2 : 1);
    if (!route || route.terminals?.[key] === terminal) return;

    state.routes = getRoutes().map((item) => {
      if (item.id !== routeId) return item;
      const terminals = { ...(item.terminals || {}), [key]: terminal };
      return {
        ...item,
        terminal: Number(item.direction) === Number(direction) ? terminal : item.terminal || "",
        terminals
      };
    });
    persist();
  }

  function normalizeRealtime(data, route) {
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const cleanLine = String(route.line || "").replace(/路$/, "");
    const matchedLine =
      lines.find((item) => {
        const lineName = String(item.line || "").replace(/路$/, "");
        return lineName === cleanLine || String(item.line || "").includes(route.line);
      }) || lines[0];

    if (!matchedLine || !Array.isArray(matchedLine.buses) || !matchedLine.buses.length) {
      return null;
    }

    const buses = matchedLine.buses
      .filter((bus) => bus && bus.status !== "已过站")
      .sort((a, b) => {
        const aStops = Number.isFinite(Number(a.stops_remaining)) ? Number(a.stops_remaining) : 999;
        const bStops = Number.isFinite(Number(b.stops_remaining)) ? Number(b.stops_remaining) : 999;
        const aMinutes = Number.isFinite(Number(a.travel_minutes)) ? Number(a.travel_minutes) : 999;
        const bMinutes = Number.isFinite(Number(b.travel_minutes)) ? Number(b.travel_minutes) : 999;
        return aStops - bStops || aMinutes - bMinutes;
      });

    const bus = buses[0] || matchedLine.buses[0];
    return {
      raw: data,
      line: matchedLine,
      bus,
      buses
    };
  }

  function openForm(routeId) {
    const existing = routeId ? getRoutes().find((route) => route.id === routeId) : null;
    setState({
      view: "form",
      form: {
        route: existing ? { ...existing } : { id: "", city: "", station: "", line: "", note: "", direction: 1, terminals: {} }
      }
    });
  }

  function saveForm(formElement) {
    const route = {
      ...state.form.route,
      id: state.form.route.id || uid(),
      city: formElement.city.value.trim(),
      station: formElement.station.value.trim(),
      line: formElement.line.value.trim(),
      note: formElement.note.value.trim(),
      direction: Number(state.form.route.direction || 1),
      terminals: state.form.route.terminals || {}
    };

    if (!route.city || !route.station || !route.line) {
      showToast("请填写完整路线信息");
      return;
    }

    const routes = getRoutes();
    const index = routes.findIndex((item) => item.id === route.id);
    const nextRoutes = index >= 0 ? routes.map((item) => (item.id === route.id ? route : item)) : [...routes, route];

    state.routes = nextRoutes;
    state.activeId = route.id;
    state.view = "settings";
    state.form = null;
    state.data = null;
    state.error = "";
    state.emptyMessage = "";
    persist();
    render();
    showToast("路线已保存");
  }

  function deleteRoute(id) {
    const route = getRoutes().find((item) => item.id === id);
    if (!route) return;
    if (!window.confirm(`删除 ${routeDisplayName(route, route.line || route.station)}？`)) return;

    const nextRoutes = getRoutes().filter((item) => item.id !== id);
    state.routes = nextRoutes;
    state.activeId = nextRoutes[0]?.id || "";
    state.data = null;
    state.error = "";
    state.emptyMessage = "";
    persist();
    render();
    showToast("已删除线路");
  }

  function changeRouteDirection(id, direction) {
    const normalizedDirection = Number(direction) === 2 ? 2 : 1;
    state.routes = getRoutes().map((route) => {
      if (route.id !== id) return route;
      const terminal = terminalForDirection(route, normalizedDirection);
      return {
        ...route,
        direction: normalizedDirection,
        terminal
      };
    });
    persist();
    setState({ data: null, error: "", emptyMessage: "" });
    preloadRouteDirections(id);
    loadRealtime();
  }

  function goHomeAndLoad() {
    setState({ view: "home", form: null, data: null, error: "", emptyMessage: "" });
  }

  function handleAction(target) {
    const actionEl = target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "settings") {
      setState({ view: "settings", error: "", emptyMessage: "" });
    }

    if (action === "back") {
      if (state.view === "form") {
        setState({ view: "settings", form: null });
      } else if (state.view === "detail") {
        goHomeAndLoad();
      } else {
        goHomeAndLoad();
      }
    }

    if (action === "activate-route") {
      state.activeId = actionEl.dataset.id;
      persist();
      setState({ view: "detail", data: null, error: "", emptyMessage: "" });
      preloadRouteDirections(actionEl.dataset.id);
      loadRealtime();
    }

    if (action === "add-route") {
      openForm("");
    }

    if (action === "edit-route") {
      openForm(actionEl.dataset.id);
    }

    if (action === "delete-route") {
      deleteRoute(actionEl.dataset.id);
    }

    if (action === "change-detail-direction") {
      const route = getActiveRoute();
      if (route && Number(route.direction) !== Number(actionEl.dataset.direction)) {
        changeRouteDirection(route.id, actionEl.dataset.direction);
      }
    }

    if (action === "refresh") {
      loadRealtime();
    }
  }

  app.addEventListener("click", (event) => {
    const deleteButton = event.target.closest('[data-action="delete-route"]');
    if (deleteButton) {
      event.stopPropagation();
    }
    handleAction(event.target);
  });

  app.addEventListener("submit", (event) => {
    if (event.target.id !== "routeForm") return;
    event.preventDefault();
    saveForm(event.target);
  });

  window.addEventListener(
    "touchstart",
    (event) => {
      pullStartY = event.touches[0]?.clientY || 0;
      pullStartedAtTop = window.scrollY <= 0 && state.view === "detail";
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (event) => {
      if (!pullStartedAtTop) return;
      const endY = event.changedTouches[0]?.clientY || 0;
      if (endY - pullStartY > 80 && getActiveRoute()) {
        showToast("正在刷新");
        loadRealtime();
      }
      pullStartedAtTop = false;
    },
    { passive: true }
  );

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  render();
})();
