"use client";

import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { formatPrice } from "@/shared/lib";
import { cn } from "@/shared/lib/utils";

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
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const onSelectHotelRef = useRef(onSelectHotel);

  useEffect(() => {
    onSelectHotelRef.current = onSelectHotel;
  }, [onSelectHotel]);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;

    if (mapError || !mapContainerRef.current) return;

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
            // Свои кнопки масштаба и разворота — как в макете
            controls: [],
          },
          { suppressMapOpenBlock: true }
        );

        mapRef.current = mapInstance;
        const geoObjects = new ymaps.GeoObjectCollection();
        // Метка — «пилюля» с ценой; выбранный отель — синяя
        const pinLayout = (isSelected: boolean) =>
          ymaps.templateLayoutFactory.createClass(
            `<div style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;padding:5px 10px;border-radius:999px;font:700 13px/1.2 system-ui,sans-serif;box-shadow:0 2px 8px rgba(17,24,39,.16);background:${
              isSelected ? "#0E41D2" : "#fff"
            };color:${isSelected ? "#fff" : "#2d3137"}">$[properties.iconContent]</div>`
          );

        hotels.forEach((hotel) => {
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
              iconContent: formatPrice(hotel.min_price_per_night_rub),
            },
            {
              iconLayout: pinLayout(isSelected),
              iconShape: {
                type: "Rectangle",
                coordinates: [
                  [-44, -14],
                  [44, 14],
                ],
              },
              zIndex: isSelected ? 1000 : undefined,
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
  }, [hotels, mapError]);

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

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setZoom(map.getZoom() + delta, { duration: 200 });
    } catch {
      // ignore
    }
  };

  // Развёрнутая карта занимает всю область каталога под шапкой сайта (не fullscreen браузера)
  const [isExpanded, setIsExpanded] = useState(false);

  // Яндекс.Карты не следят за размером контейнера — подгоняем после разворота/сворачивания
  useEffect(() => {
    try {
      mapRef.current?.container.fitToViewport();
    } catch {
      // ignore
    }
  }, [isExpanded]);

  return (
    <section
      aria-label="Карта отелей"
      className={cn(
        "overflow-hidden bg-[#EDF0F3]",
        isExpanded ? "absolute inset-0 z-30" : "relative h-full min-w-80 flex-[1_1_44.5%]"
      )}
    >
      {mapError ? (
        <ClassicSerpMapList
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          mapError={mapError}
          onSelectHotel={onSelectHotel}
        />
      ) : (
        <>
          {isLoadingMap && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#EDF0F3]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="mt-2 text-xs text-muted-foreground">Загрузка Яндекс.Карт...</span>
            </div>
          )}
          <div ref={mapContainerRef} data-testid="yandex-map-container" className="h-full w-full" />

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "Свернуть карту" : "Развернуть карту"}
            className="absolute left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-foreground shadow-[0_2px_8px_rgba(17,24,39,0.14)]"
          >
            {isExpanded ? (
              <Minimize2 className="h-[18px] w-[18px]" />
            ) : (
              <Maximize2 className="h-[18px] w-[18px]" />
            )}
          </button>
          <div className="absolute right-4 top-4 z-30 flex flex-col overflow-hidden rounded-xl bg-card shadow-[0_2px_8px_rgba(17,24,39,0.14)]">
            <button
              type="button"
              onClick={() => zoomBy(1)}
              aria-label="Приблизить"
              className="flex h-11 w-11 items-center justify-center text-foreground"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              aria-label="Отдалить"
              className="flex h-11 w-11 items-center justify-center border-t border-border text-foreground"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
