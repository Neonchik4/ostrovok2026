import { Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPinLayout(ymaps: any, isSelected: boolean) {
  return ymaps.templateLayoutFactory.createClass(
    `<div style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;padding:5px 10px;border-radius:999px;font:700 13px/1.2 system-ui,sans-serif;box-shadow:0 2px 8px rgba(17,24,39,.16);background:${
      isSelected ? "#0E41D2" : "#fff"
    };color:${isSelected ? "#fff" : "#2d3137"}">$[properties.iconContent]</div>`
  );
}

export function buildPlacemarkBalloon(hotel: Hotel) {
  return {
    hintContent: `${hotel.name} — ${formatPrice(hotel.min_price_per_night_rub)}`,
    balloonContentHeader: `<div style="font-weight:700;font-size:13px;color:#111;">${hotel.name}</div>`,
    balloonContentBody: `
      <div style="font-size:12px;color:#444;line-height:1.4;margin-top:4px;">
        <div>${hotel.stars}★ • Рейтинг ${hotel.rating.toFixed(1)}</div>
        <div style="font-weight:700;color:#0d9488;margin-top:2px;">от ${formatPrice(hotel.min_price_per_night_rub)} / ночь</div>
        ${hotel.address ? `<div style="color:#666;font-size:11px;margin-top:2px;">${hotel.address}</div>` : ""}
      </div>
    `,
    balloonContentFooter: `
      <div style="margin-top:6px;font-size:11px;">
        <a href="https://yandex.ru/maps/?text=${encodeURIComponent(hotel.name + " " + hotel.city)}" target="_blank" rel="noopener noreferrer" style="color:#0d9488;text-decoration:underline;">
          Открыть на Яндекс.Картах ↗
        </a>
      </div>
    `,
    iconContent: formatPrice(hotel.min_price_per_night_rub),
  };
}
