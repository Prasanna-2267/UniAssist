from sqlalchemy import Column, Integer, String, Date, Text, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Student(Base):
    __tablename__ = "students"

    reg_no = Column(String(20), primary_key=True)
    name = Column(String(100))
    gender = Column(String(10))
    department = Column(String(50))
    section = Column(String(10))
    advisor_id = Column(Integer)
    contact_number = Column(String(15))


class Advisor(Base):
    __tablename__ = "advisors"

    advisor_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    gender = Column(String(10))
    department = Column(String(50))
    designation = Column(String(50))
    contact_number = Column(String(15))


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    leave_id = Column(Integer, primary_key=True, index=True)
    reg_no = Column(String(20), ForeignKey("students.reg_no", ondelete="CASCADE"))
    advisor_id = Column(Integer, ForeignKey("advisors.advisor_id", ondelete="SET NULL"))
    category = Column(String(20))
    start_date = Column(Date)
    end_date = Column(Date)
    reason = Column(Text)
    status = Column(String(20), default="PENDING")
    advisor_remark = Column(Text)
    applied_at = Column(TIMESTAMP, server_default=func.now())
    reviewed_at = Column(TIMESTAMP)
