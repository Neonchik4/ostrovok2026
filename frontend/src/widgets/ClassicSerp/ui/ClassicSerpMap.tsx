"use client";

import { ExternalLink, List, Map as MapIcon, MapPin, Navigation } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";

import { loadYandexMapsScript } from "../lib/yandexMapsLoader";
import { ClassicSerpMapList } from "./ClassicSerpMapList";

interface ClassicSerpMapProps {
  hotels: Hotel[];
  selectedHotelId: string | null;
  onSelectHotel: (hotel: Hotel) => void;
}

export function ClassicSerpMap({
  hotels,
  selectedHotelId,
  onSelectHotel,
}: ClassicSerpMapProps) {
  const [activeTab, setActiveTab] = useState<"map" | "list">("map");
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const onSelectHotelRef = useRef(onSelectHotel);

  useEffect(() => {
    onSelectHotelRef.current = onSelectHotel;
  }, [onSelectHotel]);

  const city = hotels[0]?.city || "Регион";
  const selectedHotel = useMemo(
    () => hotels.find((h) => h.id === selectedHotelId) || hotels[0],
    [hotels, selectedHotelId]
  );

  const yandexMapsUrl = selectedHotel?.coordinates
    ? `https://yandex.ru/maps/?pt=${selectedHotel.coordinates.lon},${selectedHotel.coordinates.lat}&z=15&l=map`
    : `https://yandex.ru/maps/?text=${encodeURIComponent(city + " отели")}`;

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;

    if (activeTab !== "map" || !mapContainerRef.current) return;

    setIsLoadingMap(true);
    loadYandexMapsScript()
      .then((ymaps) => {
        if (!isMounted || !mapContainerRef.current) return;

        const firstValid = hotels.find((h) => h.coordinates?.lat && h.coordinates?.lon);
        const defaultCenter = firstValid?.coordinates
          ? [firstValid.coordinates.lat, firstValid.coordinates.lon]
          : [55.751244, 37.618423];

        mapInstance = new ymaps.Map(
          mapContainerRef.current,
          {
            center: defaultCenter,
            zoom: 13,
            controls: ["zoomControl", "fullscreenControl"],
          },
          { suppressMapOpenBlock: true }
        );

        mapRef.current = mapInstance;
        const geoObjects = new ymaps.GeoObjectCollection();

        hotels.forEach((hotel, idx) => {
          if (!hotel.coordinates?.lat || !hotel.coordinates?.lon) return;

          const isSelected = hotel.id === selectedHotelId;
          const placemark = new ymaps.Placemark(
            [hotel.coordinates.lat, hotel.coordinates.lon],
            {
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
              iconContent: String(idx + 1),
            },
            {
              preset: isSelected ? "islands#darkGreenIcon" : "islands#nightIcon",
              iconColor: isSelected ? "#2DD4BF" : "#38BDF8",
            }
          );

          placemark.events.add("click", () => {
            onSelectHotelRef.current(hotel);
          });

          geoObjects.add(placemark);
        });

        mapInstance.geoObjects.add(geoObjects);
        if (geoObjects.getLength() > 1) {
          mapInstance.setBounds(geoObjects.getBounds(), {
            checkZoomRange: true,
            zoomMargin: 35,
          });
        }

        setIsLoadingMap(false);
        setMapError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoadingMap(false);
        setMapError("Яндекс.Карты в автономном режиме");
        setActiveTab("list");
      });

    return () => {
      isMounted = false;
      if (mapInstance) {
        try {
          mapInstance.destroy();
        } catch {
          // ignore
        }
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, activeTab]);

  useEffect(() => {
    if (!mapRef.current || !selectedHotelId) return;
    const target = hotels.find((h) => h.id === selectedHotelId);
    if (target?.coordinates?.lat && target?.coordinates?.lon) {
      try {
        mapRef.current.panTo([target.coordinates.lat, target.coordinates.lon], {
          flying: true,
          duration: 500,
        });
      } catch {
        // ignore
      }
    }
  }, [selectedHotelId, hotels]);

  return (
    <aside className="relative flex h-full w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/60 shadow-lg backdrop-blur-md">
      {/* Шапка карты с табами */}
      <div className="flex items-center justify-between border-b border-border bg-card/80 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-bold text-foreground">Яндекс.Карты: {city}</h3>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "map"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="h-3 w-3" />
            Карта
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              activeTab === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3 w-3" />
            Список
          </button>
        </div>
      </div>

      {/* Контент: Интерактивная карта или список */}
      <div className="relative flex-1 overflow-hidden bg-background">
        {activeTab === "map" && (
          <div className="relative h-full w-full">
            {isLoadingMap && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="mt-2 text-xs text-muted-foreground">Загрузка Яндекс.Карт...</span>
              </div>
            )}
            <div
              ref={mapContainerRef}
              data-testid="yandex-map-container"
              className="h-full w-full"
            />
          </div>
        )}

        {activeTab === "list" && (
          <ClassicSerpMapList
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            mapError={mapError}
            onSelectHotel={onSelectHotel}
          />
        )}
      </div>

      {/* Футер карты с внешней ссылкой на Яндекс.Карты */}
      <div className="flex items-center justify-between border-t border-border bg-card/90 px-3 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-[11px]">
          <Navigation className="h-3 w-3 text-primary" />
          {hotels.length} меток в базе
        </span>
        <a
          href={yandexMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Яндекс.Карты
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </aside>
  );
}
