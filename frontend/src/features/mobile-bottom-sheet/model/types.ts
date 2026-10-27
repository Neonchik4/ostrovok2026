import React from "react";

export interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  badgeText?: string;
  children: React.ReactNode;
}

export interface MobileFloatingBarProps {
  hotelsCount: number;
  minPrice?: number;
  onOpen: () => void;
  className?: string;
}
