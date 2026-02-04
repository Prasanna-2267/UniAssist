from pydantic import BaseModel
from datetime import date, time
from typing import Optional

from enum import Enum

class LeaveCategory(str, Enum):
    SHORT = "SHORT"
    LONG = "LONG"
    EMERGENCY = "EMERGENCY"
    OTHERS = "OTHERS"

class LeaveApply(BaseModel):
    category: LeaveCategory
    start_date: date
    end_date: date
    reason: str



class LeaveReview(BaseModel):
    status: str
    advisor_remark: Optional[str]

class BonafideApply(BaseModel):
    reg_no: str
    category: str              
    purpose: str
    intern_start_date: Optional[date] = None
    intern_end_date: Optional[date] = None


class BonafideReview(BaseModel):
    status: str

class OutpassApply(BaseModel):
    out_date: date
    out_time: time
    purpose: str
    contact_number: str
    parent_mobile: str  # REQUIRED FOR ALL

    # Hosteller-only (conditionally required)
    in_date: Optional[date] = None
    in_time: Optional[time] = None
    hostel_id: Optional[int] = None
    floor_id: Optional[int] = None
    room_no: Optional[str] = None



class OutpassReview(BaseModel):
    status: str
    parent_mobile: Optional[str] = None