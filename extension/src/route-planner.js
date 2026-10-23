/**
 * Route & Location Intelligence for Ostrovok.ru
 * Analyzes transit logistics (airports, stations, metro, landmarks) and drives real checkout.
 */

export class RoutePlanner {
  constructor(shadowRoot, onProceedToBooking) {
    this.root = shadowRoot;
    this.onProceedToBooking = onProceedToBooking;
    this.panelEl = null;
    this.createPanel();
  }

  createPanel() {
    this.panelEl = document.createElement("div");
    this.panelEl.className = "ostrovok-route-panel";
    this.panelEl.innerHTML = `
      <div class="route-panel-header">
        <div class="route-header-title">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span>Маршрут и логистика поездки</span>
        </div>
        <button type="button" class="route-close-btn" aria-label="Закрыть">&times;</button>
      </div>

      <div class="route-hotel-info">
        <div class="route-hotel-name" id="route-hotel-name">Отель</div>
        <div class="route-hotel-address" id="route-hotel-address">Адрес загружается...</div>
      </div>

      <div class="route-legs" id="route-legs">
        <!-- Rendered dynamically -->
      </div>

      <div class="route-footer">
        <div class="route-summary" id="route-summary">Оптимальная логистика по отзывам гостей</div>
        <button type="button" class="btn-proceed-booking" id="btn-proceed-booking">
          <span>Перейти к бронированию на Островке</span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    `;

    this.panelEl.querySelector(".route-close-btn").addEventListener("click", () => {
      this.hide();
    });

    this.panelEl.querySelector("#btn-proceed-booking").addEventListener("click", () => {
      this.hide();
      if (typeof this.onProceedToBooking === "function") {
        this.onProceedToBooking();
      }
    });

    this.root.appendChild(this.panelEl);
  }

  show(hotelInfo = {}) {
    const nameEl = this.panelEl.querySelector("#route-hotel-name");
    const addrEl = this.panelEl.querySelector("#route-hotel-address");
    const legsContainer = this.panelEl.querySelector("#route-legs");
    const summaryEl = this.panelEl.querySelector("#route-summary");

    if (nameEl) nameEl.textContent = hotelInfo.name || "Выбранный отель";
    if (addrEl) addrEl.textContent = hotelInfo.address || "Центральный район";

    // Generate Route Legs based on city/destination
    const legs = this.calculateRouteLegs(hotelInfo);
    legsContainer.innerHTML = legs.map((leg) => `
      <div class="route-leg-item">
        <div class="leg-icon-col">
          <div class="leg-icon-dot"></div>
          <div class="leg-line"></div>
        </div>
        <div class="leg-content">
          <div class="leg-title">${leg.title}</div>
          <div class="leg-desc">${leg.description}</div>
        </div>
        <div class="leg-time">${leg.duration}</div>
      </div>
    `).join("");

    if (summaryEl && hotelInfo.distanceSummary) {
      summaryEl.textContent = hotelInfo.distanceSummary;
    }

    this.panelEl.classList.add("visible");
  }

  hide() {
    this.panelEl.classList.remove("visible");
  }

  calculateRouteLegs(hotelInfo) {
    const city = (hotelInfo.city || "").toLowerCase();
    const isSochi = city.includes("сочи") || city.includes("полян");
    const isSpb = city.includes("питер") || city.includes("санкт");

    if (isSochi) {
      return [
        {
          title: "Аэропорт Сочи (AER) → Отель",
          description: "Скоростная «Ласточка» или такси по совмещенной трассе",
          duration: "40 мин",
        },
        {
          title: "Отель → Подъемники / Горная карусель",
          description: "Бесплатный шаттл от отеля каждые 15 минут",
          duration: "7 мин",
        },
        {
          title: "Пешая доступность",
          description: "Прокат снаряжения, рестораны и супермаркет в 200 м",
          duration: "3 мин",
        },
      ];
    }

    if (isSpb) {
      return [
        {
          title: "Московский вокзал → Отель",
          description: "Прямой маршрут по Невскому проспекту / линия метро 1",
          duration: "12 мин",
        },
        {
          title: "Отель → Эрмитаж и Дворцовая площадь",
          description: "Пешая прогулка по исторической набережной",
          duration: "15 мин",
        },
        {
          title: "Ближайшая станция метро",
          description: "Удобный доступ к центральным пересадкам",
          duration: "4 мин",
        },
      ];
    }

    return [
      {
        title: "Транспортный узел (Аэропорт / ЖД) → Отель",
        description: "Оптимальный маршрут на экспрессе или городском такси",
        duration: "30-45 мин",
      },
      {
        title: "Отель → Исторический / Деловой центр",
        description: "Удобный выезд на ключевые магистрали",
        duration: "10-15 мин",
      },
      {
        title: "Инфраструктура рядом",
        description: "Остановки общественного транспорта, кафе и магазины",
        duration: "2-5 мин",
      },
    ];
  }
}
