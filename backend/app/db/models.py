"""Normalized SQLAlchemy ORM models with pgvector(768) and FK relations."""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.orm import declarative_base, relationship
from pgvector.sqlalchemy import Vector

Base = declarative_base()


class HotelModel(Base):
    __tablename__ = "hotels"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    city = Column(String(128), nullable=False, index=True)
    stars = Column(Integer, default=0)
    area = Column(String(255), default="")
    area_type = Column(String(64), default="")
    address = Column(String(512), default="")
    min_price_per_night_rub = Column(Integer, default=0, index=True)
    rating = Column(Float, default=0.0, index=True)
    reviews_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    image_urls = Column(JSON, default=list)
    tags = Column(JSON, default=list)

    # Векторное семантическое представление (768 dim для mpnet-base-v2)
    embedding = Column(Vector(768), nullable=True)

    # Отношения (1:N и 1:1)
    room_types = relationship("RoomTypeModel", back_populates="hotel", cascade="all, delete-orphan", lazy="selectin")
    amenities = relationship("AmenityModel", back_populates="hotel", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    policies = relationship("PolicyModel", back_populates="hotel", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    poi_distances = relationship("PoiDistanceModel", back_populates="hotel", cascade="all, delete-orphan", lazy="selectin")
    reviews = relationship("ReviewModel", back_populates="hotel", cascade="all, delete-orphan", lazy="selectin")
    proposals = relationship("EnrichmentProposalModel", back_populates="hotel")


class RoomTypeModel(Base):
    __tablename__ = "room_types"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    price_per_night_rub = Column(Integer, nullable=False)
    max_adults = Column(Integer, default=2)
    max_children = Column(Integer, default=0)
    max_total_guests = Column(Integer, default=2)
    has_balcony = Column(Boolean, default=False)
    has_kitchen = Column(Boolean, default=False)
    breakfast_included = Column(Boolean, default=False)
    bed_setup = Column(String(128), nullable=True)
    area_sqm = Column(Integer, nullable=True)

    hotel = relationship("HotelModel", back_populates="room_types")


class AmenityModel(Base):
    __tablename__ = "hotel_amenities"

    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), primary_key=True)
    pet_friendly = Column(Boolean, default=False, index=True)
    heated_pool = Column(Boolean, default=False)
    outdoor_pool = Column(Boolean, default=False)
    spa = Column(Boolean, default=False)
    sauna = Column(Boolean, default=False)
    fast_wifi = Column(Boolean, default=True)
    free_parking = Column(Boolean, default=False)
    ski_storage = Column(Boolean, default=False)
    restaurant_on_site = Column(Boolean, default=False)
    gym = Column(Boolean, default=False)

    hotel = relationship("HotelModel", back_populates="amenities")


class PolicyModel(Base):
    __tablename__ = "hotel_policies"

    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), primary_key=True)
    check_in_time = Column(String(16), default="14:00")
    check_out_time = Column(String(16), default="12:00")
    min_stay_nights = Column(Integer, default=1)
    free_cancellation_hours = Column(Integer, default=24)
    pet_allowed = Column(Boolean, default=False)
    pet_deposit_rub = Column(Integer, default=0)
    pet_daily_fee_rub = Column(Integer, default=0)
    pet_max_weight_kg = Column(Integer, default=0)

    hotel = relationship("HotelModel", back_populates="policies")


class PoiDistanceModel(Base):
    __tablename__ = "poi_distances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    poi_name = Column(String(255), nullable=False)
    category = Column(String(64), default="poi")  # beach, ski_lift, subway, transport
    distance_m = Column(Integer, nullable=False)

    hotel = relationship("HotelModel", back_populates="poi_distances")


class ReviewModel(Base):
    __tablename__ = "hotel_reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    author = Column(String(128), default="")
    date = Column(String(64), default="")
    rating = Column(Float, nullable=True)
    plus = Column(Text, default="")
    minus = Column(Text, default="")
    room = Column(String(128), default="")

    hotel = relationship("HotelModel", back_populates="reviews")


class EnrichmentProposalModel(Base):
    __tablename__ = "enrichment_proposals"

    id = Column(String(64), primary_key=True)
    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(32), default="pending", index=True)  # pending, approved, rejected
    target_type = Column(String(32), default="enrichment")  # enrichment, new_hotel
    diff_patch = Column(JSON, nullable=False)
    rationale = Column(Text, default="")
    source_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    hotel = relationship("HotelModel", back_populates="proposals")
    snapshots = relationship("AuditHotelSnapshotModel", back_populates="proposal", cascade="all, delete-orphan")


class AuditHotelSnapshotModel(Base):
    __tablename__ = "audit_hotel_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(String(64), ForeignKey("enrichment_proposals.id", ondelete="CASCADE"), nullable=False)
    hotel_id = Column(String(64), ForeignKey("hotels.id", ondelete="CASCADE"), nullable=False, index=True)
    state_before = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    proposal = relationship("EnrichmentProposalModel", back_populates="snapshots")
