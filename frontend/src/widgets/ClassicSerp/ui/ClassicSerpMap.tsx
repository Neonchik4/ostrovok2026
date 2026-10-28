"use client";

import { Maximize2, Minimize2, Minus, Plus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Hotel } from "@/entities/hotel";
import { cn } from "@/shared/lib/utils";

import { buildPlacemarkBalloon, createPinLayout } from "../lib/mapTemplates";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ymapsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const placemarksMapRef = useRef<Map<string, any>>(new Map());
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
        ymapsRef.current = ymaps;
        placemarksMapRef.current.clear();
        const geoObjects = new ymaps.GeoObjectCollection();
        hotels.forEach((hotel) => {
          if (!hotel.coordinates?.lat || !hotel.coordinates?.lon) return;

          const isSelected = hotel.id === selectedHotelId;
          const placemark = new ymaps.Placemark(
            [hotel.coordinates.lat, hotel.coordinates.lon],
            buildPlacemarkBalloon(hotel),
            {
              iconLayout: createPinLayout(ymaps, isSelected),
              iconShape: {
                type: "Rectangle",
                coordinates: [
                  [-44, -14],
                  [44, 14],
                ],
              },
              zIndex: isSelected ? 1000 : 1,
            }
          );

          placemark.events.add("click", () => {
            onSelectHotelRef.current(hotel);
          });

          placemarksMapRef.current.set(hotel.id, placemark);
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

    const currentPlacemarks = placemarksMapRef.current;
    return () => {
      isMounted = false;
      if (mapInstance) {
        try {
          mapInstance.destroy();
        } catch {
          // ignore
        }
        mapRef.current = null;
        ymapsRef.current = null;
        currentPlacemarks.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, mapError]);

  useEffect(() => {
    if (!mapRef.current || !selectedHotelId) return;
    const target = hotels.find((h) => h.id === selectedHotelId);
    if (target?.coordinates?.lat && target?.coordinates?.lon) {
      try {
        const curZoom = typeof mapRef.current.getZoom === "function" ? mapRef.current.getZoom() : 13;
        const targetCoords = [target.coordinates.lat, target.coordinates.lon];
        if (typeof mapRef.current.setCenter === "function") {
          mapRef.current.setCenter(targetCoords, Math.max(curZoom, 14), { flying: true, duration: 600 });
        } else if (typeof mapRef.current.panTo === "function") {
          mapRef.current.panTo(targetCoords, { flying: true, duration: 500 });
        }
      } catch {}

      // Обновляем визуальное выделение меток и открываем балун
      const ymaps = ymapsRef.current;
      if (ymaps) {
        placemarksMapRef.current.forEach((pm, hid) => {
          const isSelected = hid === selectedHotelId;
          try {
            pm.options.set("iconLayout", createPinLayout(ymaps, isSelected));
            pm.options.set("zIndex", isSelected ? 1000 : 1);
            if (isSelected && pm.balloon) {
              pm.balloon.open();
            }
          } catch {
            // ignore
          }
        });
      }
    }
  }, [selectedHotelId, hotels]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setZoom(map.getZoom() + delta, { duration: 200 });
    } catch {}
  };

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    try {
      mapRef.current?.container.fitToViewport();
    } catch {}
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
