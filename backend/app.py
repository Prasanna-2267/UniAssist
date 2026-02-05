from fastapi import APIRouter, FastAPI, Depends, HTTPException, UploadFile, File, Form 
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta, time
from sqlalchemy import text
from pydantic import BaseModel
from pathlib import Path
import os,uuid

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from database import SessionLocal, engine
import models, schemas
from schemas import LeaveApply, LeaveReview, BonafideApply, BonafideReview, OutpassApply, OutpassReview

from fastapi import UploadFile, File
from typing import List
import os
from uuid import uuid4
from datetime import date, time
from typing import Optional

from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/google-login")

from dotenv import load_dotenv
load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Leave Approval System")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def remove_coop_headers(request, call_next):
    response = await call_next(request)

    # DO NOT overwrite, just set safely
    response.headers.setdefault("Cross-Origin-Opener-Policy", "unsafe-none")
    response.headers.setdefault("Cross-Origin-Embedder-Policy", "unsafe-none")

    return response

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "default-secret")
ALGORITHM = "HS256"

def verify_google_token(token: str):
    try:
        return id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception:
        return None

def create_jwt(payload: dict):
    payload["exp"] = datetime.utcnow() + timedelta(days=1)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

class GoogleLoginRequest(BaseModel):
    token: str

@app.middleware("http")
async def remove_coop_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "unsafe-none"
    response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
    return response

@app.post("/auth/google-login")
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):

    info = verify_google_token(payload.token)
    if not info:
        raise HTTPException(401, "Invalid Google token")

    email = info["email"]

    # 🔐 College domain check
    if not email.endswith("@citchennai.net"):
        raise HTTPException(403, "Only college email allowed")

    # ===================== PREFER USERS TABLE =====================
    # Check users table first — this is the single source of truth for role
    user = db.execute(
        text("SELECT * FROM users WHERE email = :email"),
        {"email": email}
    ).mappings().first()

    if not user:
        # User not in users table yet — fallback to students/faculty/advisors
        # Check students table
        student = db.execute(
            text("SELECT reg_no FROM students WHERE email = :email"),
            {"email": email}
        ).mappings().first()

        if student:
            reg_no = student["reg_no"]
            db.execute(
                text("""
                    INSERT INTO users (email, reg_no, role)
                    VALUES (:email, :reg_no, 'STUDENT')
                """),
                {"email": email, "reg_no": reg_no}
            )
            db.commit()

            user = db.execute(
                text("SELECT * FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().first()

        else:
            # Not a student — check faculty/advisors table
            # 🔹 Check ADVISOR
            advisor = db.execute(
                text("SELECT advisor_id FROM advisors WHERE email = :email"),
                {"email": email}
            ).fetchone()

            # 🔹 Check HOD
            hod = db.execute(
                text("SELECT hod_id FROM hods WHERE email = :email"),
                {"email": email}
            ).fetchone()

            # 🔹 Check WARDEN
            warden = db.execute(
                text("SELECT warden_id FROM wardens WHERE email = :email"),
                {"email": email}
            ).fetchone()

# ===================== FACULTY ROLE RESOLUTION =====================

            if advisor:
                db.execute(
                    text("""
                        INSERT INTO users (email, role)
                        VALUES (:email, 'ADVISOR')
                    """),
                    {"email": email}
                )
                db.commit()

            elif hod:
                db.execute(
                    text("""
                        INSERT INTO users (email, role)
                        VALUES (:email, 'HOD')
                    """),
                    {"email": email}
                )
                db.commit()

            elif warden:
                db.execute(
                    text("""
                        INSERT INTO users (email, role)
                        VALUES (:email, 'WARDEN')
                    """),
                    {"email": email}
                )
                db.commit()

            else:
                raise HTTPException(403, "No account found")

            user = db.execute(
                text("SELECT * FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().first()


            user = db.execute(
                text("SELECT * FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().first()

    # ===================== TOKEN CREATION =====================
    token = create_jwt({
        "user_id": user["user_id"],
        "email": user["email"],
        "reg_no": user.get("reg_no"),
        "role": user["role"].lower()
    })

    return {
        "access_token": token,
        "reg_no": user.get("reg_no"),
        "role": user["role"].lower(),
        "email": email,
        "name": info.get("name")
    }


security = HTTPBearer()

def get_current_user(token=Depends(security), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])

        if "role" not in payload:
            raise HTTPException(401, "Invalid token")

        # Student safety
        if payload["role"] == "student" and not payload.get("reg_no"):
            raise HTTPException(401, "Invalid student token")

        # Advisor safety
        if payload["role"] == "advisor" and not payload.get("advisor_id"):
            raise HTTPException(401, "Invalid advisor token")


        if payload["role"] == "warden":
            # If token already has it, fine
            if payload.get("warden_id"):
                return payload

            # Otherwise fetch from DB using email
            email = payload.get("sub") or payload.get("email")

            warden = db.execute(
                text("SELECT warden_id FROM wardens WHERE email = :e"),
                {"e": email}
            ).mappings().first()

            if not warden:
                raise HTTPException(401, "Invalid warden token")

            payload["warden_id"] = warden["warden_id"]

        return payload

    except Exception:
        raise HTTPException(401, "Invalid or expired token")


# ---------------------------
# TEST API
# ---------------------------
@app.get("/test-auth")
def test_auth(user=Depends(get_current_user)):
    return user

def send_mail_with_pdfs(to_email, subject, body, pdf_paths: list[str]):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = os.getenv("SENDER_MAIL")
    msg["To"] = to_email
    msg.set_content(body)

    for path in pdf_paths:
        if path:
            with open(path, "rb") as f:
                msg.add_attachment(
                    f.read(),
                    maintype="application",
                    subtype="pdf",
                    filename=os.path.basename(path)
                )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(
            os.getenv("SENDER_MAIL"),
            os.getenv("APP_PASSWORD")
        )
        smtp.send_message(msg)

def get_current_user_soft(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except:
        return None

#--- Leave Application Endpoint ---

from datetime import date
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from datetime import date
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

VALID_CATEGORIES = {"SHORT", "LONG", "EMERGENCY","OTHERS"}

@app.post("/leave/apply")
def apply_leave(
    leave: LeaveApply,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only students can apply
    if user["role"].lower() != "student":
        raise HTTPException(403, "Only students allowed")
    
    reg_no = user["reg_no"]

    # -----------------------------
    # 1️⃣ BASIC DATE VALIDATIONS
    # -----------------------------
    if leave.start_date > leave.end_date:
        raise HTTPException(400, "Start date cannot be after end date")

    leave_days = (leave.end_date - leave.start_date).days + 1

    if leave_days <= 0:
        raise HTTPException(400, "Invalid leave duration")

    if leave_days > 30:
        raise HTTPException(400, "Leave duration cannot exceed 30 days")

    # -----------------------------
    # 2️⃣ CATEGORY VALIDATION
    # -----------------------------
    if leave.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail="Invalid leave category"
        )

    # -----------------------------
    # 3️⃣ FETCH STUDENT DETAILS
    # -----------------------------
    student = db.execute(
        text("""
            SELECT department, year_of_study, residence_type
            FROM students
            WHERE reg_no = :reg_no
        """),
        {"reg_no": reg_no}
    ).fetchone()

    if not student:
        raise HTTPException(404, "Student not found")

    if student.department != "CSE":
        raise HTTPException(
            status_code=403,
            detail="This system is applicable only for CSE department"
        )

    if student.year_of_study not in [2, 3, 4]:
        raise HTTPException(
            status_code=403,
            detail="Only 2nd, 3rd and 4th year students are allowed"
        )

    today = date.today()

    # -----------------------------
    # 4️⃣ CATEGORY‑SPECIFIC RULES
    # -----------------------------
    if leave.category == "LONG" and leave.start_date <= today:
        raise HTTPException(400, "Long leave must be applied in advance")

    if leave.category == "SHORT":
        if leave_days > 2:
            raise HTTPException(400, "Short leave max duration is 2 days")

    if leave.category == "EMERGENCY" and leave.start_date != today:
        raise HTTPException(400, "Emergency leave must be for today")

    # -----------------------------
    # 5️⃣ OVERLAPPING LEAVE CHECK
    # -----------------------------
    overlap = db.execute(
        text("""
            SELECT 1
            FROM leave_requests
            WHERE reg_no = :reg_no
              AND status IN ('PENDING', 'APPROVED')
              AND (
                    start_date <= :end_date
                AND end_date >= :start_date
              )
        """),
        {
            "reg_no": reg_no,
            "start_date": leave.start_date,
            "end_date": leave.end_date
        }
    ).first()

    if overlap:
        raise HTTPException(
            status_code=409,
            detail="Leave already exists for the selected dates"
        )

    # -----------------------------
    # 6️⃣ CREATE LEAVE REQUEST
    # -----------------------------
    new_leave = models.LeaveRequest(
        reg_no=reg_no,
        category=leave.category,
        start_date=leave.start_date,
        end_date=leave.end_date,
        reason=leave.reason,
        status="PENDING"
    )

    db.add(new_leave)
    db.commit()
    db.refresh(new_leave)

    return {
        "message": "Leave applied successfully",
        "leave_id": new_leave.leave_id,
        "status": new_leave.status
    }


@app.get("/leave/advisor/pending")
def view_pending_leaves(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    leaves = db.execute(
        text("""
            SELECT 
                lr.leave_id,
                lr.reg_no,
                s.name AS student_name,
                lr.category,
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status
            FROM leave_requests lr
            JOIN students s ON s.reg_no = lr.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE lr.status = 'PENDING'
            ORDER BY lr.leave_id DESC
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return leaves



@app.put("/leave/review/{leave_id}")
def review_leave(
    leave_id: int,
    review: schemas.LeaveReview,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    result = db.execute(
        text("""
            UPDATE leave_requests
            SET status = :status,
                acted_advisor_id = :advisor_id,
                advisor_remark = :remark,
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE leave_id = :leave_id
            AND status = 'PENDING'
        """),
        {
            "status": review.status,
            "remark": review.advisor_remark,
            "advisor_id": advisor_id,
            "leave_id": leave_id
        }
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Already reviewed by another advisor")

    # Fetch student email
    leave = db.execute(
        text("""
            SELECT s.email
            FROM leave_requests l
            JOIN students s ON s.reg_no = l.reg_no
            WHERE l.leave_id = :lid
        """),
        {"lid": leave_id}
    ).mappings().first()

    send_mail_with_pdfs(
        to_email=leave["email"],
        subject=f"Leave {review.status}",
        body=f"Your leave request has been {review.status.lower()} by your advisor.",
        pdf_paths=[]
    )

    db.commit()

    return {
        "message": f"Leave {review.status.lower()} successfully",
        "leave_id": leave_id
    }


@app.get("/leave/advisor/history")
def view_reviewed_leaves(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    result = db.execute(
        text("""
            SELECT
                lr.leave_id,
                lr.reg_no,
                s.name AS student_name,
                lr.category,
                lr.start_date,
                lr.end_date,
                lr.status,
                lr.advisor_remark,
                lr.advisor_reviewed_at
            FROM leave_requests lr
            JOIN students s ON s.reg_no = lr.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE lr.status <> 'PENDING'
            ORDER BY lr.advisor_reviewed_at DESC
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return result



#--- Bonafide Certificate Endpoints ---


from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import date
from jinja2 import Environment, FileSystemLoader
from email.message import EmailMessage
import smtplib
import os
import pdfkit
TEMPLATE_MAP = {
    "SCHOLARSHIP": "scholarship_bonafide.html",
    "EDUCATIONAL_LOAN": "educational_loan_bonafide.html",
    "INTERNSHIP": "internship_bonafide.html",
    "GENERAL": "general_bonafide.html"
}

# -------------------------------
# WKHTMLTOPDF CONFIG
# -------------------------------
WKHTMLTOPDF_PATH = r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
config = pdfkit.configuration(wkhtmltopdf=WKHTMLTOPDF_PATH)

# -------------------------------
# PDF GENERATION
# -------------------------------
def generate_bonafide_pdf(data):

    env = Environment(loader=FileSystemLoader("templates"))
    template = env.get_template(TEMPLATE_MAP[data["category"]])

    html_content = template.render(
        name=data["name"],
        reg_no=data["reg_no"],
        department=data["department"],
        section=data["section"],
        year_of_study=data["year_of_study"],
        academic_year="2024-2025",
        purpose=data["purpose"],
        intern_start_date=data.get("intern_start_date"),
        intern_end_date=data.get("intern_end_date"),
        date=date.today()
    )

    os.makedirs("bonafides", exist_ok=True)
    pdf_path = f"bonafides/bonafide_{data['reg_no']}.pdf"

    options = {
        "page-size": "A4",
        "encoding": "UTF-8",
        "enable-local-file-access": ""
    }

    pdfkit.from_string(
        html_content,
        pdf_path,
        options=options,
        configuration=config
    )

    return pdf_path

# -------------------------------
# EMAIL SENDER
# -------------------------------
def send_bonafide_email(to_email: str, pdf_path: str):
    import smtplib, ssl
    from email.message import EmailMessage

    msg = EmailMessage()
    msg["Subject"] = "Bonafide Certificate Approved"
    msg["From"] = os.getenv("SENDER_MAIL")
    msg["To"] = to_email
    msg.set_content(
        "Dear Student,\n\n"
        "Your bonafide certificate has been approved.\n"
        "Please find the attached PDF.\n\n"
        "Regards,\nCollege Administration"
    )

    with open(pdf_path, "rb") as f:
        msg.add_attachment(
            f.read(),
            maintype="application",
            subtype="pdf",
            filename="bonafide_certificate.pdf"
        )

    context = ssl.create_default_context()

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as smtp:
        smtp.login(os.getenv("SENDER_MAIL"), os.getenv("APP_PASSWORD"))
        smtp.send_message(msg)



@app.post("/bonafide/apply")
def apply_bonafide(
    data: BonafideApply,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user["role"].lower() != "student":
        raise HTTPException(403, "Only students allowed")

    reg_no = user["reg_no"]

    student = db.execute(
        text("""
            SELECT department, section, year_of_study
            FROM students
            WHERE reg_no = :reg_no
        """),
        {"reg_no": reg_no}
    ).fetchone()

    if not student:
        raise HTTPException(404, "Student not found")

    if student.department != "CSE":
        raise HTTPException(403, "This system is applicable only for CSE department")

    if student.year_of_study not in [2, 3, 4]:
        raise HTTPException(403, "Only 2nd, 3rd and 4th year students are allowed")

    department = student.department
    section = student.section
    year_of_study = student.year_of_study

    # 🔽 HOD logic unchanged
    if year_of_study == 1:
        hod = db.execute(text("SELECT hod_id FROM hods WHERE is_first_year = TRUE")).fetchone()
    else:
        hod = db.execute(
            text("SELECT hod_id FROM hods WHERE department = :department AND is_first_year = FALSE"),
            {"department": department}
        ).fetchone()

    if not hod:
        raise HTTPException(404, "HOD not found")

    # Internship validation unchanged
    if data.category == "INTERNSHIP":
        if not data.intern_start_date or not data.intern_end_date:
            raise HTTPException(400, "Internship dates required")
        if data.intern_start_date > data.intern_end_date:
            raise HTTPException(400, "Invalid date range")

    db.execute(
        text("""
            INSERT INTO bonafide_requests
            (reg_no, hod_id, category, purpose, intern_start_date, intern_end_date, advisor_status, hod_status)
            VALUES (:reg_no, :hod_id, :category, :purpose, :intern_start_date, :intern_end_date, 'PENDING', 'PENDING')
        """),
        {
            "reg_no": reg_no,
            "hod_id": hod.hod_id,
            "category": data.category,
            "purpose": data.purpose,
            "intern_start_date": data.intern_start_date,
            "intern_end_date": data.intern_end_date
        }
    )

    db.commit()
    return {"message": "Bonafide request submitted successfully"}



@app.get("/bonafide/advisor/pending")
def advisor_pending_bonafide(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    result = db.execute(
        text("""
            SELECT
                b.request_id,
                s.name AS student_name,
                s.reg_no,
                s.department,
                s.section,
                s.year_of_study,
                b.category,
                b.purpose,
                b.intern_start_date,
                b.intern_end_date,
                b.advisor_status
            FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE b.advisor_status = 'PENDING'
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return result


@app.put("/bonafide/advisor/review/{request_id}")
def advisor_review(
    request_id: int,
    review: BonafideReview,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    result = db.execute(
        text("""
            UPDATE bonafide_requests
            SET advisor_status = :status,
                acted_advisor_id = :advisor_id,
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE request_id = :rid
            AND advisor_status = 'PENDING'
        """),
        {"status": review.status, "advisor_id": advisor_id, "rid": request_id}
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Already reviewed")

    db.commit()
    return {"message": f"Advisor {review.status.lower()} successfully"}


@app.get("/bonafide/advisor/history")
def advisor_bonafide_history(user=Depends(get_current_user), db: Session = Depends(get_db)):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    result = db.execute(
        text("""
            SELECT
                b.request_id,
                s.name AS student_name,
                s.reg_no,
                s.section,
                s.year_of_study,
                b.category,
                b.purpose,
                b.advisor_status,
                b.advisor_reviewed_at
            FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE b.advisor_status <> 'PENDING'
            ORDER BY b.advisor_reviewed_at DESC
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return result


@app.get("/bonafide/hod/pending")
def hod_pending_bonafide(user=Depends(get_current_user), db: Session = Depends(get_db)):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    result = db.execute(
        text("""
            SELECT
                b.request_id,
                s.name AS student_name,
                s.reg_no,
                s.section,
                s.year_of_study,
                b.category,
                b.purpose,
                b.advisor_status,
                b.hod_status
            FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            WHERE b.hod_id = :hid
            AND b.advisor_status = 'APPROVED'
            AND b.hod_status = 'PENDING'
        """),
        {"hid": hod_id}
    ).mappings().all()

    return result

@app.put("/bonafide/hod/review/{request_id}")
def hod_review(request_id: int, review: BonafideReview, user=Depends(get_current_user), db: Session = Depends(get_db)):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    result = db.execute(
        text("""
            UPDATE bonafide_requests
            SET hod_status = :status,
                hod_reviewed_at = CURRENT_TIMESTAMP
            WHERE request_id = :rid
            AND advisor_status = 'APPROVED'
            AND hod_status = 'PENDING'
        """),
        {"status": review.status, "rid": request_id}
    )

    if result.rowcount == 0:
        raise HTTPException(404, "Not eligible")

    # PDF + mail logic unchanged
    if review.status == "APPROVED":
        data = db.execute(text("""SELECT s.name, s.reg_no, s.department, s.section, s.year_of_study, s.email, b.purpose, b.category, b.intern_start_date, b.intern_end_date FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE b.request_id=:rid"""), {"rid": request_id}).mappings().first()
        pdf_path = generate_bonafide_pdf(data)
        send_bonafide_email(data["email"], pdf_path)

    db.commit()
    return {"message": f"HOD {review.status.lower()} successfully"}

@app.get("/bonafide/hod/history")
def hod_bonafide_history(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    result = db.execute(
        text("""
            SELECT
                b.request_id,
                s.name AS student_name,      -- 👤 Student name
                s.reg_no,                    -- 🆔 Register number
                s.department,
                s.section,                   -- 🏫 Class section
                s.year_of_study,             -- 🎓 Year
                b.category,
                b.purpose,
                b.intern_start_date,
                b.intern_end_date,
                b.advisor_status,
                b.hod_status,
                b.hod_reviewed_at
            FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            WHERE b.hod_id = :hid
            AND b.hod_status <> 'PENDING'      -- Only reviewed ones
            ORDER BY b.hod_reviewed_at DESC
        """),
        {"hid": hod_id}
    ).mappings().all()

    return result


#-----------------------------------------------
#--- Outpass Application Endpoints ---
#-----------------------------------------------

from jinja2 import Environment, FileSystemLoader
from datetime import datetime
import os
import pdfkit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
PDF_DIR = os.path.join(BASE_DIR, "generated_pdfs")

os.makedirs(PDF_DIR, exist_ok=True)

env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

def generate_outpass_pdf(outpass: dict):
    template = env.get_template("hostel_outpass.html")

    logo_fs_path = os.path.join(BASE_DIR, "static", "logo2.jpeg")
    verified_fs_path = os.path.join(BASE_DIR, "static", "verified.jpeg")

    logo_path = "file:///" + logo_fs_path.replace("\\", "/")
    verified_path = "file:///" + verified_fs_path.replace("\\", "/")

    html_content = template.render(
        name=outpass["name"],
        date=datetime.now().strftime("%d-%m-%Y"),
        department=outpass["department"],
        year_of_study=outpass["year_of_study"],
        room_no=outpass["room_no"],
        parent_mobile=outpass["parent_mobile"],
        student_mobile=outpass["contact_number"],
        purpose=outpass["purpose"],
        out_date=outpass["out_date"],
        in_date=outpass["in_date"],
        out_time=outpass["out_time"],
        in_time=outpass["in_time"],
        logo_path=logo_path,
        verified_path=verified_path
    )

    pdf_path = os.path.join(
        PDF_DIR, f"outpass_{outpass['outpass_id']}.pdf"
    )

    options = {
        "page-size": "A4",
        "encoding": "UTF-8",
        "enable-local-file-access": None
    }

    pdfkit.from_string(
        html_content,
        pdf_path,
        configuration=config,
        options=options
    )

    return pdf_path

def generate_leave_pdf(outpass: dict) -> str:
    """
    Generates Leave PDF for multi-day hostel outpass
    Returns absolute pdf path
    """

    template = env.get_template("hostel_leaveform.html")

    # -------------------------------------------------
    # FILE SYSTEM PATHS (wkhtmltopdf compatible)
    # -------------------------------------------------
    logo_fs_path = os.path.join(BASE_DIR, "static", "logo2.jpeg")
    verified_fs_path = os.path.join(BASE_DIR, "static", "verified.jpeg")

    logo_path = "file:///" + logo_fs_path.replace("\\", "/")
    verified_path = "file:///" + verified_fs_path.replace("\\", "/")

    # -------------------------------------------------
    # RENDER HTML
    # -------------------------------------------------
    html_content = template.render(
        name=outpass["name"],
        department=outpass["department"],
        year_of_study=outpass["year_of_study"],
        room_no=outpass["room_no"],
        parent_mobile=outpass["parent_mobile"],
        student_mobile=outpass["contact_number"],
        purpose=outpass["purpose"],
        out_date=outpass["out_date"],
        in_date=outpass["in_date"],
        out_time=outpass["out_time"],
        in_time=outpass["in_time"],
        logo_path=logo_path,
        verified_path=verified_path
    )

    # -------------------------------------------------
    # PDF OUTPUT PATH
    # -------------------------------------------------
    pdf_path = os.path.join(
        PDF_DIR, f"leave_{outpass['outpass_id']}.pdf"
    )

    # -------------------------------------------------
    # PDF OPTIONS
    # -------------------------------------------------
    options = {
        "page-size": "A4",
        "encoding": "UTF-8",
        "enable-local-file-access": None
    }

    # -------------------------------------------------
    # GENERATE PDF
    # -------------------------------------------------
    pdfkit.from_string(
        html_content,
        pdf_path,
        configuration=config,
        options=options
    )

    return pdf_path

@app.post("/outpass/apply")
def apply_outpass(
    data: OutpassApply,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # 🔐 Only students can apply
    if user["role"].lower() != "student":
        raise HTTPException(403, "Only students allowed")

    reg_no = user["reg_no"]

    # ----------------------------
    # FETCH STUDENT
    # ----------------------------
    student = db.execute(
        text("""
            SELECT department, section, year_of_study,
                   residence_type, email
            FROM students
            WHERE reg_no = :reg_no
        """),
        {"reg_no": reg_no}
    ).fetchone()

    if not student:
        raise HTTPException(404, "Student not found")

    # ----------------------------
    # DEPT & YEAR RESTRICTION
    # ----------------------------
    if student.department != "CSE":
        raise HTTPException(403, "This system is applicable only for CSE department")

    if student.year_of_study not in [2, 3, 4]:
        raise HTTPException(403, "Only 2nd, 3rd and 4th year students are allowed")

    # ----------------------------
    # COMMON REQUIRED FIELDS
    # ----------------------------
    common_missing = []

    if not data.out_date:
        common_missing.append("out_date")
    if not data.out_time:
        common_missing.append("out_time")
    if not data.purpose:
        common_missing.append("purpose")
    if not data.contact_number:
        common_missing.append("contact_number")
    if not data.parent_mobile:
        common_missing.append("parent_mobile")

    if common_missing:
        raise HTTPException(
            400,
            f"Missing required fields: {', '.join(common_missing)}"
        )

    if not data.parent_mobile.isdigit() or len(data.parent_mobile) != 10:
        raise HTTPException(400, "Parent mobile must be a valid 10-digit number")

    # ----------------------------
    # CALCULATE DAYS
    # ----------------------------
    if data.in_date:
        days = (data.in_date - data.out_date).days + 1
        if days < 1:
            raise HTTPException(400, "In-date cannot be before out-date")
    else:
        days = 1

    # ----------------------------
    # ISSUE 4: OVERLAP CHECK
    # ----------------------------
    overlap = db.execute(
        text("""
            SELECT 1
            FROM outpass_requests
            WHERE reg_no = :reg_no
              AND (
                    advisor_status IN ('PENDING','APPROVED')
                 OR hod_status     IN ('PENDING','APPROVED')
                 OR warden_status  IN ('PENDING','APPROVED')
              )
              AND (
                    out_date <= :new_in_date
                AND COALESCE(in_date, out_date) >= :new_out_date
              )
        """),
        {
            "reg_no": reg_no,
            "new_out_date": data.out_date,
            "new_in_date": data.in_date or data.out_date
        }
    ).first()

    if overlap:
        raise HTTPException(
            status_code=409,
            detail="Outpass already exists for the selected dates"
        )

    # ----------------------------
    # DAY SCHOLAR RULES
    # ----------------------------
    if student.residence_type == "DAY_SCHOLAR":
        forbidden_fields = {
            "in_date": data.in_date,
            "in_time": data.in_time,
            "hostel_id": data.hostel_id,
            "floor_id": data.floor_id,
            "room_no": data.room_no
        }

        sent_forbidden = [k for k, v in forbidden_fields.items() if v is not None]

        if sent_forbidden:
            raise HTTPException(
                400,
                f"Day scholars must not enter hostel details: {', '.join(sent_forbidden)}"
            )

    # ----------------------------
    # HOSTELLER RULES (ISSUE 3)
    # ----------------------------
    if student.residence_type == "HOSTEL":

        hostel_missing = []

        if not data.in_date:
            hostel_missing.append("in_date")
        if not data.in_time:
            hostel_missing.append("in_time")
        if not data.hostel_id:
            hostel_missing.append("hostel_id")
        if not data.floor_id:
            hostel_missing.append("floor_id")
        if not data.room_no:
            hostel_missing.append("room_no")

        if hostel_missing:
            raise HTTPException(
                400,
                f"Hostel students must provide: {', '.join(hostel_missing)}"
            )

        # 🔒 STRICT MULTI-DAY ENFORCEMENT
        if days > 1 and not data.in_date:
            raise HTTPException(
                400,
                "Multi-day outpass requires in-date for hostellers"
            )

    # ----------------------------
    # INSERT OUTPASS
    # ----------------------------
    db.execute(
        text("""
            INSERT INTO outpass_requests (
                reg_no, year_of_study,
                out_date, out_time,
                in_date, in_time,
                purpose,
                contact_number,
                parent_mobile,
                hostel_id, floor_id, room_no,
                advisor_status, hod_status, warden_status
            )
            VALUES (
                :reg_no, :year_of_study,
                :out_date, :out_time,
                :in_date, :in_time,
                :purpose,
                :contact_number,
                :parent_mobile,
                :hostel_id, :floor_id, :room_no,
                'PENDING','PENDING','PENDING'
            )
        """),
        {
            **data.dict(),
            "reg_no": reg_no,
            "year_of_study": student.year_of_study
        }
    )

    db.commit()

    return {
        "message": "Outpass submitted successfully",
        "days": days,
        "leave_required": student.residence_type == "HOSTEL" and days > 1
    }


@app.get("/outpass/advisor/pending")
def advisor_pending_outpass(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    result = db.execute(
        text("""
            SELECT
                o.outpass_id,
                s.name AS student_name,
                s.reg_no,
                s.section,
                s.year_of_study,
                s.residence_type,
                o.out_date,
                o.out_time,
                o.in_date,
                o.in_time,
                o.purpose,
                o.contact_number
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE o.advisor_status = 'PENDING'
            ORDER BY o.outpass_id DESC
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return result


@app.put("/outpass/advisor/review/{outpass_id}")
def advisor_review_outpass(
    outpass_id: int,
    review: OutpassReview,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisors allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # 1️⃣ UPDATE ADVISOR STATUS (same logic)
    result = db.execute(
        text("""
            UPDATE outpass_requests
            SET advisor_status = :status,
                acted_advisor_id = :advisor_id
            WHERE outpass_id = :oid
            AND advisor_status = 'PENDING'
        """),
        {
            "status": review.status,
            "advisor_id": advisor_id,
            "oid": outpass_id
        }
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Already reviewed by another advisor")

    db.commit()  # same flow

    # 2️⃣ FETCH STUDENT EMAIL (unchanged logic)
    outpass = db.execute(
        text("""
            SELECT o.out_date, s.email
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.outpass_id = :oid
        """),
        {"oid": outpass_id}
    ).mappings().first()

    if not outpass:
        raise HTTPException(404, "Outpass not found")

    # 3️⃣ MAIL ONLY IF REJECTED (same)
    if review.status == "REJECTED":
        send_mail_with_pdfs(
            to_email=outpass["email"],
            subject="Outpass Rejected",
            body=(
                f"Your outpass request has been rejected by Advisor.\n\n"
                f"Outpass ID : {outpass_id}\n"
                f"Date       : {outpass['out_date']}"
            ),
            pdf_paths=[]
        )

    return {"message": f"Advisor {review.status.lower()} successfully"}

@app.get("/outpass/hod/pending")
def hod_pending_outpass(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    result = db.execute(
        text("""
            SELECT
                o.outpass_id,
                s.name AS student_name,   -- 👤 clearer naming
                s.reg_no,
                s.section,
                s.year_of_study,
                s.residence_type,
                o.out_date,
                o.out_time,
                o.purpose
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            JOIN hods h ON h.department = s.department
            WHERE h.hod_id = :hod_id
              AND o.advisor_status = 'APPROVED'
              AND o.hod_status = 'PENDING'
            ORDER BY o.outpass_id DESC
        """),
        {"hod_id": hod_id}
    ).mappings().all()

    return result

@app.put("/outpass/hod/review/{outpass_id}")
def hod_review_outpass(
    outpass_id: int,
    review: OutpassReview,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # 1️⃣ UPDATE HOD STATUS (DB FIRST) — SAME LOGIC
    result = db.execute(
        text("""
            UPDATE outpass_requests
            SET hod_status = :status,
                acted_hod_id = :hid
            WHERE outpass_id = :oid
            AND advisor_status = 'APPROVED'
            AND hod_status = 'PENDING'
        """),
        {"status": review.status, "hid": hod_id, "oid": outpass_id}
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Not eligible for HOD review")

    db.commit()  # ✅ commit immediately (same as yours)

    # 2️⃣ FETCH OUTPASS + STUDENT (UNCHANGED)
    outpass = db.execute(
        text("""
            SELECT
                o.*,
                s.name,
                s.department,
                s.year_of_study,
                s.residence_type,
                s.email
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.outpass_id = :oid
        """),
        {"oid": outpass_id}
    ).mappings().first()

    # 3️⃣ DAY SCHOLAR → FINAL (PDF + MAIL) — SAME
    if review.status == "APPROVED" and outpass["residence_type"] == "DAY_SCHOLAR":
        try:
            outpass_pdf = generate_outpass_pdf(outpass)

            send_mail_with_pdfs(
                to_email=outpass["email"],
                subject="Outpass Approved",
                body=(
                    f"Your outpass request has been approved.\n\n"
                    f"Outpass ID : {outpass_id}\n"
                    f"Date       : {outpass['out_date']}\n"
                    f"Time       : {outpass['out_time']}"
                ),
                pdf_paths=[outpass_pdf]
            )
        except Exception as e:
            print("HOD mail/pdf error:", e)

    # 4️⃣ REJECTION MAIL — SAME
    if review.status == "REJECTED":
        send_mail_with_pdfs(
            to_email=outpass["email"],
            subject="Outpass Rejected",
            body=(
                f"Your outpass request has been rejected by HOD.\n\n"
                f"Outpass ID : {outpass_id}\n"
                f"Date: {outpass['out_date']}"
            ),
            pdf_paths=[]
        )

    return {"message": f"HOD {review.status.lower()} successfully"}


@app.get("/outpass/warden/pending")
def warden_pending_outpass(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only Warden allowed
    if user["role"].lower() != "warden":
        raise HTTPException(403, "Only wardens allowed")

    warden_id = user.get("warden_id")
    print("WARDEN ID:", warden_id)

    result = db.execute(
        text("""
            SELECT
                o.outpass_id,
                s.name AS student_name,   -- 👤 added
                s.reg_no,
                s.year_of_study,
                s.section,
                o.out_date,
                o.out_time,
                o.in_date,
                o.in_time,
                o.room_no,
                o.purpose
            FROM outpass_requests o
            JOIN hostel_floors hf ON hf.floor_id = o.floor_id
            JOIN students s ON s.reg_no = o.reg_no
            WHERE hf.warden_id = :warden_id
              AND UPPER(o.hod_status) = 'APPROVED'
              AND COALESCE(o.warden_status, 'PENDING') = 'PENDING'
            ORDER BY o.outpass_id DESC
        """),
        {"warden_id": warden_id}
    ).mappings().all()

    return result


@app.put("/outpass/warden/review/{outpass_id}")
def warden_review_outpass(
    outpass_id: int,
    review: OutpassReview,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only Warden allowed
    if user["role"].lower() != "warden":
        raise HTTPException(403, "Only wardens allowed")

    warden_id = user.get("warden_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # -------------------------------------------------
    # 1️⃣ UPDATE STATUS FIRST (UNCHANGED LOGIC)
    # -------------------------------------------------
    result = db.execute(
        text("""
            UPDATE outpass_requests
            SET warden_status = :status,
                acted_warden_id = :wid
            WHERE outpass_id = :oid
            AND hod_status = 'APPROVED'
            AND warden_status = 'PENDING'
        """),
        {
            "status": review.status,
            "wid": warden_id,
            "oid": outpass_id
        }
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Not eligible for warden review")

    db.commit()  # ✅ same as your flow

    # -------------------------------------------------
    # 2️⃣ FETCH OUTPASS + STUDENT DATA (UNCHANGED)
    # -------------------------------------------------
    outpass = db.execute(
        text("""
            SELECT
                o.*,
                s.name,
                s.department,
                s.year_of_study,
                s.email
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.outpass_id = :oid
        """),
        {"oid": outpass_id}
    ).mappings().first()

    # -------------------------------------------------
    # 3️⃣ CALCULATE DAYS (UNCHANGED)
    # -------------------------------------------------
    if outpass["in_date"]:
        days = (outpass["in_date"] - outpass["out_date"]).days + 1
    else:
        days = 1

    # -------------------------------------------------
    # 4️⃣ GENERATE PDFs + SEND MAIL (UNCHANGED)
    # -------------------------------------------------
    if review.status == "APPROVED":
        try:
            pdfs = []

            outpass_pdf = generate_outpass_pdf(outpass)
            pdfs.append(outpass_pdf)

            if days > 1:
                leave_pdf = generate_leave_pdf(outpass)
                pdfs.append(leave_pdf)

            send_mail_with_pdfs(
                to_email=outpass["email"],
                subject="Outpass Approved" if days == 1 else "Outpass & Leave Approved",
                body=(
                    f"Your request has been approved.\n\n"
                    f"Outpass ID : {outpass_id}\n"
                    f"From Date  : {outpass['out_date']}\n"
                    f"To Date    : {outpass['in_date']}"
                ),
                pdf_paths=pdfs
            )

        except Exception as e:
            print("PDF / Mail error:", e)

    if review.status == "REJECTED":
        send_mail_with_pdfs(
            to_email=outpass["email"],
            subject="Outpass Rejected",
            body=(
                f"Your outpass request has been rejected by Warden.\n\n"
                f"Outpass ID : {outpass_id}\n"
                f"Date: {outpass['out_date']}"
            ),
            pdf_paths=[]
        )

    return {"message": f"Warden {review.status.lower()} successfully"}




#------------------------------------------------
#--- OD Application Endpoints ---
#------------------------------------------------

class ODApply(BaseModel):
    from_date: date
    to_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    purpose: str
    place: Optional[str] = None

class ODReview(BaseModel):
    status: str
    remark: Optional[str] = None


from fastapi import UploadFile, File
from typing import List
import os
from uuid import uuid4

from fastapi import Form, File, UploadFile, Depends, HTTPException
from datetime import date, time
from typing import List

@app.post("/od/apply")
def apply_od(
    # 🔥 READ FROM multipart/form-data INSTEAD OF QUERY
    from_date: date = Form(...),
    to_date: date = Form(...),
    purpose: str = Form(...),
    start_time: time | None = Form(None),
    end_time: time | None = Form(None),
    place: str | None = Form(None),

    proof_files: List[UploadFile] = File(default=[]),
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔹 Recreate ODApply object so your logic below remains SAME
    data = ODApply(
        from_date=from_date,
        to_date=to_date,
        purpose=purpose,
        start_time=start_time,
        end_time=end_time,
        place=place
    )

    # 🔐 Only students can apply
    if user["role"].lower() != "student":
        raise HTTPException(403, "Only students allowed")

    reg_no = user["reg_no"]

    # 1️⃣ Fetch student
    student = db.execute(
        text("""
            SELECT department, year_of_study
            FROM students
            WHERE reg_no = :reg_no
        """),
        {"reg_no": reg_no}
    ).fetchone()

    if not student:
        raise HTTPException(404, "Student not found")

    # 2️⃣ Project scope validation
    if student.department != "CSE":
        raise HTTPException(403, "OD applicable only for CSE department")

    if student.year_of_study not in [2, 3, 4]:
        raise HTTPException(403, "OD applicable only for 2nd, 3rd & 4th years")

    # 3️⃣ Date validation
    if data.from_date > data.to_date:
        raise HTTPException(400, "From date cannot be after To date")

    # 4️⃣ Time validation
    if data.start_time and data.end_time:
        if data.start_time >= data.end_time:
            raise HTTPException(400, "Start time must be before end time")

    # 5️⃣ File validation
    if len(proof_files) > 3:
        raise HTTPException(400, "Maximum 3 proof files allowed")

    # 6️⃣ Insert OD request
    result = db.execute(
        text("""
            INSERT INTO od_requests (
                reg_no, from_date, to_date,
                start_time, end_time,
                purpose, place,
                advisor_status, hod_status
            )
            VALUES (
                :reg_no, :from_date, :to_date,
                :start_time, :end_time,
                :purpose, :place,
                'PENDING', 'PENDING'
            )
            RETURNING od_id
        """),
        {
            "reg_no": reg_no,
            "from_date": data.from_date,
            "to_date": data.to_date,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "purpose": data.purpose,
            "place": data.place
        }
    )

    od_id = result.fetchone()[0]

    # 7️⃣ Save proof files
    os.makedirs("od_proofs", exist_ok=True)

    for file in proof_files:
        filename = f"{uuid4()}_{file.filename}"
        file_path = os.path.join("od_proofs", filename)

        with open(file_path, "wb") as f:
            f.write(file.file.read())

        db.execute(
            text("""
                INSERT INTO od_proofs (od_id, file_path)
                VALUES (:od_id, :file_path)
            """),
            {"od_id": od_id, "file_path": file_path}
        )

    db.commit()

    return {
        "message": "OD request submitted successfully",
        "od_id": od_id
    }


@app.get("/od/advisor/pending")
def advisor_pending_od(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only advisor allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    result = db.execute(
        text("""
            SELECT
                o.od_id,
                s.name AS student_name,
                s.reg_no,
                s.section,
                s.year_of_study,
                o.from_date,
                o.to_date,
                o.start_time,
                o.end_time,
                o.purpose,
                o.place
            FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            JOIN section_advisors sa
              ON sa.advisor_id = :advisor_id
             AND sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE o.advisor_status = 'PENDING'
            ORDER BY o.od_id DESC
        """),
        {"advisor_id": advisor_id}
    ).mappings().all()

    return result


@app.put("/od/advisor/review/{od_id}")
def advisor_review_od(
    od_id: int,
    review: ODReview,
    user=Depends(get_current_user),   # 🔐 ADDED
    db: Session = Depends(get_db)
):
    # 🔐 Only advisor allowed
    if user["role"].lower() != "advisor":
        raise HTTPException(403, "Only advisors allowed")

    advisor_id = user.get("advisor_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # 1️⃣ UPDATE STATUS (same logic)
    result = db.execute(
        text("""
            UPDATE od_requests
            SET advisor_status = :status,
                acted_advisor_id = :advisor_id,   -- stored securely
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE od_id = :oid
              AND advisor_status = 'PENDING'
        """),
        {
            "status": review.status,
            "advisor_id": advisor_id,
            "oid": od_id
        }
    )

    # 2️⃣ Fetch student email (unchanged)
    od = db.execute(
        text("""
            SELECT s.email
            FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.od_id = :oid
        """),
        {"oid": od_id}
    ).mappings().first()

    # 3️⃣ Send mail ONLY if advisor rejects (same behavior)
    if review.status == "REJECTED":
        send_mail_with_pdfs(
            to_email=od["email"],
            subject="OD Rejected by Advisor",
            body="Your OD request has been rejected by your advisor.",
            pdf_paths=[]
        )

    if result.rowcount == 0:
        raise HTTPException(409, "Already reviewed")

    db.commit()

    return {"message": f"Advisor {review.status.lower()} OD"}


@app.get("/od/hod/pending")
def hod_pending_od(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    result = db.execute(
        text("""
            SELECT
                o.od_id,
                s.name AS student_name,   -- 👤 Added
                s.reg_no,
                s.section,
                s.year_of_study,
                o.from_date,
                o.to_date,
                o.start_time,
                o.end_time,
                o.purpose,
                o.place
            FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            JOIN hods h ON h.department = s.department
            WHERE h.hod_id = :hid
              AND o.advisor_status = 'APPROVED'
              AND o.hod_status = 'PENDING'
            ORDER BY o.od_id DESC
        """),
        {"hid": hod_id}
    ).mappings().all()

    return result

@app.put("/od/hod/review/{od_id}")
def hod_review_od(
    od_id: int,
    review: ODReview,
    user=Depends(get_current_user),   # 🔐 ADDED
    db: Session = Depends(get_db)
):
    # 🔐 Only HOD allowed
    if user["role"].lower() != "hod":
        raise HTTPException(403, "Only HOD allowed")

    hod_id = user.get("hod_id")

    if review.status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # 1️⃣ UPDATE OD STATUS (UNCHANGED LOGIC)
    result = db.execute(
        text("""
            UPDATE od_requests
            SET hod_status = :status,
                hod_remark = :remark,
                acted_hod_id = :hod_id,              -- stored securely
                hod_reviewed_at = CURRENT_TIMESTAMP
            WHERE od_id = :oid
              AND advisor_status = 'APPROVED'
              AND hod_status = 'PENDING'
        """),
        {
            "status": review.status,
            "remark": review.remark,
            "hod_id": hod_id,
            "oid": od_id
        }
    )

    if result.rowcount == 0:
        raise HTTPException(409, "Not eligible for HOD review")

    # 2️⃣ FETCH STUDENT EMAIL (UNCHANGED)
    od = db.execute(
        text("""
            SELECT s.email
            FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.od_id = :oid
        """),
        {"oid": od_id}
    ).mappings().first()

    # 3️⃣ FINAL MAIL (UNCHANGED BEHAVIOR)
    send_mail_with_pdfs(
        to_email=od["email"],
        subject=f"OD {review.status}",
        body=(
            f"Your OD request has been {review.status.lower()}."
            + (f"\n\nRemark: {review.remark}" if review.remark else "")
        ),
        pdf_paths=[]
    )

    db.commit()

    return {"message": f"HOD {review.status.lower()} OD"}


#-----------------------------------------------
#---- Intelligent Complaint categorization ----
#-----------------------------------------------
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Initialize Gemini
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)

# Prompt template
prompt = ChatPromptTemplate.from_template(
    """
You are a college complaint routing system.

Available departments:
- WATER
- ELECTRICITY
- TRANSPORT
- SANITATION
- ACADEMICS
- HOSTEL
- CANTEEN
- GENERAL

VERY IMPORTANT RULE (DO NOT VIOLATE):
If the complaint mentions or implies:
- hostel
- room number
- hostel block
- warden
- hostel infrastructure
- hostel electricity / water / sanitation / mess

Then the complaint MUST be classified as: HOSTEL
Even if it mentions electricity, water, or sanitation.

Only if the issue is NOT related to hostel, classify normally.

Return ONLY ONE department name.
No explanation.
No punctuation.

Complaint:
{complaint}
"""


)
ALLOWED = {
    "WATER", "ELECTRICITY", "TRANSPORT", "SANITATION",
    "ACADEMICS", "HOSTEL", "CANTEEN", "GENERAL"
}
# Build chain (NEW STYLE)
chain = prompt | llm | StrOutputParser()

def classify_complaint(complaint_text: str) -> str:
    try:
        chain = prompt | llm | StrOutputParser()
        result = chain.invoke({"complaint": complaint_text})
        return result if result in ALLOWED else "GENERAL"
    except Exception as e:
        print("LangChain Gemini error:", e)
        return "GENERAL"
    
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "complaint_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

@app.post("/complaints/create")
def create_complaint(
    complaint_text: str = Form(...),
    file: UploadFile | None = File(None),
    user=Depends(get_current_user),        # 🔐 ADDED
    db: Session = Depends(get_db)
):
    # 🔐 Only students can raise complaints
    if user["role"].lower() != "student":
        raise HTTPException(403, "Only students allowed")

    reg_no = user["reg_no"]   # ✅ SECURE SOURCE

    attachment_path = None
    attachment_name = None

    # ------------------------
    # FILE VALIDATION (MAX 1)
    # ------------------------
    if file:
        ext = Path(file.filename).suffix.lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, "Invalid file type")

        content = file.file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(400, "File size exceeds 5MB")

        file.file.seek(0)

        unique_name = f"{uuid.uuid4()}{ext}"
        save_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(save_path, "wb") as f:
            f.write(content)

        attachment_path = save_path
        attachment_name = file.filename

    # ------------------------
    # GEMINI CLASSIFICATION (UNCHANGED)
    # ------------------------
    department = classify_complaint(complaint_text)

    # ------------------------
    # INSERT INTO DATABASE (UNCHANGED)
    # ------------------------
    db.execute(
        text("""
            INSERT INTO complaints
            (reg_no, complaint_text, department, attachment_path, attachment_name)
            VALUES (:reg_no, :text, :dept, :path, :name)
        """),
        {
            "reg_no": reg_no,        # 🔐 secure
            "text": complaint_text,
            "dept": department,
            "path": attachment_path,
            "name": attachment_name
        }
    )
    db.commit()

    return {
        "message": "Complaint submitted successfully",
        "department": department,
        "file_attached": bool(file)
    }


@app.get("/dept/complaints")
def get_department_complaints(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only department in‑charge allowed
    if user["role"].lower() != "incharge":
        raise HTTPException(403, "Only department in‑charge allowed")

    incharge_id = user.get("incharge_id")

    # 1️⃣ Find department for this in‑charge (same logic)
    incharge = db.execute(
        text("""
            SELECT department
            FROM department_incharges
            WHERE incharge_id = :id
        """),
        {"id": incharge_id}
    ).mappings().first()

    if not incharge:
        raise HTTPException(404, "Department in‑charge not found")

    department = incharge["department"]

    # 2️⃣ Fetch complaints (added student info)
    complaints = db.execute(
        text("""
            SELECT
                c.complaint_id,
                s.name AS student_name,
                s.reg_no,
                s.section,
                s.year_of_study,
                c.complaint_text,
                c.department,
                c.status,
                c.attachment_name,
                c.created_at
            FROM complaints c
            JOIN students s ON s.reg_no = c.reg_no
            WHERE c.department = :dept
            ORDER BY c.created_at DESC
        """),
        {"dept": department}
    ).mappings().all()

    return {
        "department": department,
        "total": len(complaints),
        "complaints": complaints
    }


@app.put("/dept/complaints/update/{complaint_id}")
def update_complaint_status(
    complaint_id: int,
    status: str,
    user=Depends(get_current_user),      # 🔐 ADDED
    db: Session = Depends(get_db)
):
    # 🔐 Only department in‑charge allowed
    if user["role"].lower() != "incharge":
        raise HTTPException(403, "Only department in‑charge allowed")

    incharge_id = user.get("incharge_id")
    status = status.upper()

    if status not in {"OPEN", "IN_PROGRESS", "RESOLVED"}:
        raise HTTPException(400, "Invalid status")

    # 1️⃣ Get in‑charge department (same logic)
    incharge = db.execute(
        text("""
            SELECT department
            FROM department_incharges
            WHERE incharge_id = :id
        """),
        {"id": incharge_id}
    ).mappings().first()

    if not incharge:
        raise HTTPException(404, "In‑charge not found")

    # 2️⃣ Update only if complaint belongs to same department (UNCHANGED)
    result = db.execute(
        text("""
            UPDATE complaints
            SET status = :status
            WHERE complaint_id = :cid
              AND department = :dept
        """),
        {
            "status": status,
            "cid": complaint_id,
            "dept": incharge["department"]
        }
    )

    if result.rowcount == 0:
        raise HTTPException(
            403,
            "Not authorized or complaint not found"
        )

    db.commit()

    return {"message": "Complaint status updated"}

from sqlalchemy import text

from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

@app.get("/student/recent-requests")
def get_recent_requests(
    limit: int = 5,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only students
    if user["role"].lower() != "student":
        raise HTTPException(403, "Students only")

    reg_no = user["reg_no"]

    query = text("""
        SELECT leave_id AS id, 'LEAVE' AS type, applied_at AS created_at, status
        FROM leave_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT request_id AS id, 'BONAFIDE', applied_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM bonafide_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT outpass_id AS id, 'OUTPASS', created_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' OR warden_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' AND warden_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM outpass_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT od_id AS id, 'OD', created_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM od_requests WHERE reg_no=:reg_no

        ORDER BY created_at DESC
        LIMIT :limit
    """)

    rows = db.execute(query, {"reg_no": reg_no, "limit": limit}).fetchall()

    return [
        {
            "id": r.id,
            "type": r.type,
            "created_at": r.created_at,
            "status": r.status
        }
        for r in rows
    ]

router = APIRouter(prefix="/student", tags=["Student Dashboard"])
@router.get("student/dashboard-stats")
def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔥 JWT returns dict, not object
    reg_no = current_user["reg_no"]

    query = text("""
        SELECT
            SUM(total)    AS total,
            SUM(pending)  AS pending,
            SUM(approved) AS approved,
            SUM(rejected) AS rejected
        FROM (

            -- LEAVE (single status column)
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='PENDING')  AS pending,
                   COUNT(*) FILTER (WHERE status='APPROVED') AS approved,
                   COUNT(*) FILTER (WHERE status='REJECTED') AS rejected
            FROM leave_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- BONAFIDE (advisor + HOD)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING' OR hod_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED' AND hod_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED' OR hod_status='REJECTED'
                   )
            FROM bonafide_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- OUTPASS (advisor + HOD + warden)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING'
                          OR hod_status='PENDING'
                          OR warden_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED'
                          AND hod_status='APPROVED'
                          AND warden_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED'
                          OR hod_status='REJECTED'
                          OR warden_status='REJECTED'
                   )
            FROM outpass_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- OD (advisor + HOD)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING' OR hod_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED' AND hod_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED' OR hod_status='REJECTED'
                   )
            FROM od_requests
            WHERE reg_no = :reg_no

        ) t
    """)

    result = db.execute(query, {"reg_no": reg_no}).fetchone()

    return {
        "pending": result.pending or 0,
        "approved": result.approved or 0,
        "rejected": result.rejected or 0,
        "total": result.total or 0,
    }


@app.get("/student/dashboard-stats")
def get_dashboard_stats(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only students
    if user["role"].lower() != "student":
        raise HTTPException(403, "Students only")

    reg_no = user["reg_no"]

    query = text("""
        SELECT
            SUM(total)    AS total,
            SUM(pending)  AS pending,
            SUM(approved) AS approved,
            SUM(rejected) AS rejected
        FROM (

            -- LEAVE (single status column)
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='PENDING')  AS pending,
                   COUNT(*) FILTER (WHERE status='APPROVED') AS approved,
                   COUNT(*) FILTER (WHERE status='REJECTED') AS rejected
            FROM leave_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- BONAFIDE (advisor + HOD)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING' OR hod_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED' AND hod_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED' OR hod_status='REJECTED'
                   )
            FROM bonafide_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- OUTPASS (advisor + HOD + warden)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING'
                          OR hod_status='PENDING'
                          OR warden_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED'
                          AND hod_status='APPROVED'
                          AND warden_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED'
                          OR hod_status='REJECTED'
                          OR warden_status='REJECTED'
                   )
            FROM outpass_requests
            WHERE reg_no = :reg_no

            UNION ALL

            -- OD (advisor + HOD)
            SELECT COUNT(*),
                   COUNT(*) FILTER (
                       WHERE advisor_status='PENDING' OR hod_status='PENDING'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='APPROVED' AND hod_status='APPROVED'
                   ),
                   COUNT(*) FILTER (
                       WHERE advisor_status='REJECTED' OR hod_status='REJECTED'
                   )
            FROM od_requests
            WHERE reg_no = :reg_no

        ) t
    """)

    result = db.execute(query, {"reg_no": reg_no}).fetchone()

    return {
        "pending": result.pending or 0,
        "approved": result.approved or 0,
        "rejected": result.rejected or 0,
        "total": result.total or 0,
    }


@app.get("/student/requests")
def get_all_student_requests(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 🔐 Only students
    if user["role"].lower() != "student":
        raise HTTPException(403, "Students only")

    reg_no = user["reg_no"]

    query = text("""
        SELECT leave_id AS id, 'LEAVE' AS type, applied_at AS created_at, status
        FROM leave_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT request_id AS id, 'BONAFIDE', applied_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM bonafide_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT outpass_id AS id, 'OUTPASS', created_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' OR warden_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' AND warden_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM outpass_requests WHERE reg_no=:reg_no

        UNION ALL

        SELECT od_id AS id, 'OD', created_at,
               CASE
                   WHEN advisor_status='REJECTED' OR hod_status='REJECTED' THEN 'REJECTED'
                   WHEN advisor_status='APPROVED' AND hod_status='APPROVED' THEN 'APPROVED'
                   ELSE 'PENDING'
               END
        FROM od_requests WHERE reg_no=:reg_no

        ORDER BY created_at DESC
    """)

    rows = db.execute(query, {"reg_no": reg_no}).fetchall()

    return [
        {
            "id": r.id,
            "type": r.type,
            "created_at": r.created_at,
            "status": r.status
        }
        for r in rows
    ]


@router.get("/requests")
def get_all_requests(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reg_no = current_user["reg_no"]

    query = text("""
        SELECT leave_id AS id,
       'LEAVE' AS type,
       applied_at AS created_at,
       status
FROM leave_requests
WHERE reg_no = :reg_no

UNION ALL

SELECT request_id AS id,
       'BONAFIDE' AS type,
       applied_at AS created_at,
       advisor_status AS status
FROM bonafide_requests
WHERE reg_no = :reg_no

UNION ALL

SELECT outpass_id AS id,
       'OUTPASS' AS type,
       created_at AS created_at,
       advisor_status AS status
FROM outpass_requests
WHERE reg_no = :reg_no

UNION ALL

SELECT od_id AS id,
       'OD' AS type,
       created_at AS created_at,
       advisor_status AS status
FROM od_requests
WHERE reg_no = :reg_no

ORDER BY created_at DESC
LIMIT :limit

    """)

    rows = db.execute(query, {"reg_no": reg_no, "limit": 50}).fetchall()


    return [
    {
        "id": r.id,
        "type": r.type.lower(),
        "status": r.status.lower(),
        "createdAt": r.created_at or r.applied_at  # important
    }
    for r in rows
    ]


from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text



@app.get("/advisor/history")
def advisor_full_history(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    advisor = db.execute(
        text("SELECT advisor_id, department FROM advisors WHERE email = :email"),
        {"email": email}
    ).fetchone()

    if not advisor:
        raise HTTPException(403, "Not an advisor")

    aid = advisor.advisor_id
    dept = advisor.department

    # ---------------- LEAVE HISTORY ----------------
    leaves = db.execute(text("""
        SELECT
            l.leave_id AS request_id,
            'LEAVE' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            l.start_date,
            l.end_date,
            l.category,
            l.status,
            l.reviewed_at AS reviewed_at
        FROM leave_requests l
        JOIN students s ON s.reg_no = l.reg_no
        WHERE l.acted_advisor_id = :aid
          AND l.status <> 'PENDING'
        ORDER BY l.reviewed_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- BONAFIDE HISTORY ----------------
    bonafides = db.execute(text("""
        SELECT
            b.request_id AS request_id,
            'BONAFIDE' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            b.category,
            b.purpose,
            b.advisor_status AS status,
            b.advisor_reviewed_at AS reviewed_at
        FROM bonafide_requests b
        JOIN students s ON s.reg_no = b.reg_no
        WHERE b.acted_advisor_id = :aid
          AND b.advisor_status <> 'PENDING'
        ORDER BY b.advisor_reviewed_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- OUTPASS HISTORY ----------------
    outpasses = db.execute(text("""
        SELECT
            o.outpass_id AS request_id,
            'OUTPASS' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            o.out_date,
            o.purpose,
            o.advisor_status AS status,
            o.created_at AS reviewed_at   -- fallback since review time not stored
        FROM outpass_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE o.acted_advisor_id = :aid
          AND o.advisor_status <> 'PENDING'
        ORDER BY o.created_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- OD HISTORY ----------------
    ods = db.execute(text("""
        SELECT
            o.od_id AS request_id,
            'OD' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            o.from_date,
            o.to_date,
            o.purpose,
            o.advisor_status AS status,
            o.advisor_reviewed_at AS reviewed_at
        FROM od_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE o.advisor_status <> 'PENDING'
          AND s.department = :dept
        ORDER BY o.advisor_reviewed_at DESC
    """), {"dept": dept}).mappings().all()

    return {
        "leaves": leaves,
        "bonafides": bonafides,
        "outpasses": outpasses,
        "ods": ods
    }


@app.get("/advisor/pending")
def advisor_pending_requests(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    advisor = db.execute(
        text("SELECT advisor_id FROM advisors WHERE email = :email"),
        {"email": email}
    ).fetchone()

    if not advisor:
        raise HTTPException(403, "Not an advisor")

    aid = advisor.advisor_id

    # 🔹 Students under this advisor
    student_filter = """
        s.reg_no IN (
            SELECT s.reg_no
            FROM students s
            JOIN section_advisors sa
              ON sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE sa.advisor_id = :aid
        )
    """

    # ---------------- LEAVE PENDING ----------------
    leaves = db.execute(text(f"""
        SELECT
            l.leave_id AS request_id,
            'LEAVE' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            l.start_date,
            l.end_date,
            l.category,
            l.applied_at AS created_at
        FROM leave_requests l
        JOIN students s ON s.reg_no = l.reg_no
        WHERE l.status = 'PENDING'
          AND {student_filter}
        ORDER BY l.applied_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- BONAFIDE PENDING ----------------
    bonafides = db.execute(text(f"""
        SELECT
            b.request_id AS request_id,
            'BONAFIDE' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            b.category,
            b.purpose,
            b.applied_at AS created_at
        FROM bonafide_requests b
        JOIN students s ON s.reg_no = b.reg_no
        WHERE b.advisor_status = 'PENDING'
          AND {student_filter}
        ORDER BY b.applied_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- OUTPASS PENDING ----------------
    outpasses = db.execute(text(f"""
        SELECT
            o.outpass_id AS request_id,
            'OUTPASS' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            o.out_date,
            o.out_time,
            o.purpose,
            o.created_at
        FROM outpass_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE o.advisor_status = 'PENDING'
          AND {student_filter}
        ORDER BY o.created_at DESC
    """), {"aid": aid}).mappings().all()

    # ---------------- OD PENDING ----------------
    ods = db.execute(text(f"""
        SELECT
            o.od_id AS request_id,
            'OD' AS type,
            s.name,
            s.reg_no,
            s.section,
            s.year_of_study,
            o.from_date,
            o.to_date,
            o.purpose,
            o.created_at
        FROM od_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE o.advisor_status = 'PENDING'
          AND {student_filter}
        ORDER BY o.created_at DESC
    """), {"aid": aid}).mappings().all()

    return {
        "leaves": leaves,
        "bonafides": bonafides,
        "outpasses": outpasses,
        "ods": ods
    }

@app.put("/advisor/review/{req_type}/{req_id}")
def advisor_review_request(
    req_type: str,
    req_id: int,
    data: dict,
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    advisor = db.execute(
        text("SELECT advisor_id FROM advisors WHERE email = :email"),
        {"email": email}
    ).fetchone()

    if not advisor:
        raise HTTPException(403, "Not an advisor")

    aid = advisor.advisor_id
    status = data.get("status")

    if status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(400, "Invalid status")

    # ================= LEAVE =================
    if req_type == "leave":
        result = db.execute(text("""
            UPDATE leave_requests
            SET status = :status,
                advisor_remark = :remark,
                acted_advisor_id = :aid,
                reviewed_at = CURRENT_TIMESTAMP,
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE leave_id = :id
              AND status = 'PENDING'
        """), {
            "status": status,
            "remark": data.get("advisor_remark"),
            "aid": aid,
            "id": req_id
        })

    # ================= BONAFIDE =================
    elif req_type == "bonafide":
        result = db.execute(text("""
            UPDATE bonafide_requests
            SET advisor_status = :status,
                acted_advisor_id = :aid,
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE request_id = :id
              AND advisor_status = 'PENDING'
        """), {
            "status": status,
            "aid": aid,
            "id": req_id
        })

    # ================= OUTPASS =================
    elif req_type == "outpass":
        result = db.execute(text("""
            UPDATE outpass_requests
            SET advisor_status = :status,
                acted_advisor_id = :aid
            WHERE outpass_id = :id
              AND advisor_status = 'PENDING'
        """), {
            "status": status,
            "aid": aid,
            "id": req_id
        })

    # ================= OD =================
    elif req_type == "od":
        result = db.execute(text("""
            UPDATE od_requests
            SET advisor_status = :status,
                advisor_reviewed_at = CURRENT_TIMESTAMP
            WHERE od_id = :id
              AND advisor_status = 'PENDING'
        """), {
            "status": status,
            "id": req_id
        })

    else:
        raise HTTPException(400, "Invalid request type")

    if result.rowcount == 0:
        raise HTTPException(409, "Already reviewed or not found")

    db.commit()
    return {"message": f"{req_type.upper()} {status} successfully"}


@app.get("/advisor/dashboard-stats")
def advisor_dashboard_stats(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    advisor = db.execute(text("""
        SELECT advisor_id, department
        FROM advisors
        WHERE email = :email
    """), {"email": email}).fetchone()

    if not advisor:
        raise HTTPException(403, "Not an advisor")

    aid = advisor.advisor_id

    # Students handled by advisor
    student_filter = """
        s.reg_no IN (
            SELECT s.reg_no
            FROM students s
            JOIN section_advisors sa
              ON sa.department = s.department
             AND sa.section = s.section
             AND sa.year_of_study = s.year_of_study
            WHERE sa.advisor_id = :aid
        )
    """

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT leave_id FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no WHERE {student_filter}
            UNION ALL
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE {student_filter}
        ) x
    """), {"aid": aid}).scalar()

    pending = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT leave_id FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no WHERE l.status='PENDING' AND {student_filter}
            UNION ALL
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE b.advisor_status='PENDING' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='PENDING' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='PENDING' AND {student_filter}
        ) x
    """), {"aid": aid}).scalar()

    approved = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT leave_id FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no WHERE l.status='APPROVED' AND {student_filter}
            UNION ALL
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE b.advisor_status='APPROVED' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='APPROVED' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='APPROVED' AND {student_filter}
        ) x
    """), {"aid": aid}).scalar()

    rejected = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT leave_id FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no WHERE l.status='REJECTED' AND {student_filter}
            UNION ALL
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE b.advisor_status='REJECTED' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='REJECTED' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='REJECTED' AND {student_filter}
        ) x
    """), {"aid": aid}).scalar()

    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected
    }

@app.get("/advisor/pending-preview")
def advisor_pending_preview(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")
    aid = db.execute(text("SELECT advisor_id FROM advisors WHERE email=:e"),
                     {"e": email}).scalar()

    student_filter = """
        s.reg_no IN (
            SELECT s.reg_no
            FROM students s
            JOIN section_advisors sa
              ON sa.department=s.department
             AND sa.section=s.section
             AND sa.year_of_study=s.year_of_study
            WHERE sa.advisor_id=:aid
        )
    """

    data = db.execute(text(f"""
        SELECT * FROM (
            SELECT 'LEAVE' type, l.leave_id id, s.name, l.applied_at dt
            FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no
            WHERE l.status='PENDING' AND {student_filter}

            UNION ALL
            SELECT 'BONAFIDE', b.request_id, s.name, b.applied_at
            FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no
            WHERE b.advisor_status='PENDING' AND {student_filter}

            UNION ALL
            SELECT 'OUTPASS', o.outpass_id, s.name, o.created_at
            FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.advisor_status='PENDING' AND {student_filter}

            UNION ALL
            SELECT 'OD', o.od_id, s.name, o.created_at
            FROM od_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.advisor_status='PENDING' AND {student_filter}
        ) x
        ORDER BY dt DESC
        LIMIT 5
    """), {"aid": aid}).mappings().all()

    return data

@app.get("/advisor/request-breakdown")
def advisor_request_breakdown(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    email = payload.get("sub") or payload.get("email")
    aid = db.execute(text("SELECT advisor_id FROM advisors WHERE email=:e"),
                     {"e": email}).scalar()

    student_filter = """
        s.reg_no IN (
            SELECT s.reg_no FROM students s
            JOIN section_advisors sa
            ON sa.department=s.department
            AND sa.section=s.section
            AND sa.year_of_study=s.year_of_study
            WHERE sa.advisor_id=:aid
        )
    """

    return {
        "leave": db.execute(text(f"SELECT COUNT(*) FROM leave_requests l JOIN students s ON s.reg_no=l.reg_no WHERE l.status='PENDING' AND {student_filter}"), {"aid": aid}).scalar(),
        "bonafide": db.execute(text(f"SELECT COUNT(*) FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE b.advisor_status='PENDING' AND {student_filter}"), {"aid": aid}).scalar(),
        "outpass": db.execute(text(f"SELECT COUNT(*) FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='PENDING' AND {student_filter}"), {"aid": aid}).scalar(),
        "od": db.execute(text(f"SELECT COUNT(*) FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE o.advisor_status='PENDING' AND {student_filter}"), {"aid": aid}).scalar(),
    }

@app.get("/hod/dashboard-stats")
def hod_dashboard_stats(payload=Depends(get_current_user_soft), db: Session = Depends(get_db)):
    email = payload.get("sub") or payload.get("email")

    hod = db.execute(text("SELECT hod_id, department FROM hods WHERE email=:e"),
                     {"e": email}).mappings().first()

    if not hod:
        raise HTTPException(403, "Not HOD")

    dept = hod["department"]

    student_filter = "s.department = :dept"

    total = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no WHERE {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no WHERE {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no WHERE {student_filter}
        ) x
    """), {"dept": dept}).scalar()

    pending = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no
            WHERE b.advisor_status='APPROVED' AND b.hod_status='PENDING' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.advisor_status='APPROVED' AND o.hod_status='PENDING' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.advisor_status='APPROVED' AND o.hod_status='PENDING' AND {student_filter}
        ) x
    """), {"dept": dept}).scalar()

    approved = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no
            WHERE b.hod_status='APPROVED' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.hod_status='APPROVED' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.hod_status='APPROVED' AND {student_filter}
        ) x
    """), {"dept": dept}).scalar()

    rejected = db.execute(text(f"""
        SELECT COUNT(*) FROM (
            SELECT request_id FROM bonafide_requests b JOIN students s ON s.reg_no=b.reg_no
            WHERE b.hod_status='REJECTED' AND {student_filter}
            UNION ALL
            SELECT outpass_id FROM outpass_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.hod_status='REJECTED' AND {student_filter}
            UNION ALL
            SELECT od_id FROM od_requests o JOIN students s ON s.reg_no=o.reg_no
            WHERE o.hod_status='REJECTED' AND {student_filter}
        ) x
    """), {"dept": dept}).scalar()

    return {"total": total, "pending": pending, "approved": approved, "rejected": rejected}

@app.get("/hod/pending")
def hod_pending_preview(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    dept = db.execute(
        text("SELECT department FROM hods WHERE email=:e"),
        {"e": email}
    ).scalar()

    if not dept:
        raise HTTPException(403, "Not a HOD")

    data = db.execute(text("""
        SELECT * FROM (

            -- 🔵 BONAFIDE
            SELECT 
                'BONAFIDE' AS type,
                b.request_id AS id,
                s.name,
                s.reg_no,
                s.department,
                b.applied_at AS dt
            FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            WHERE b.hod_status = 'PENDING'
              AND b.advisor_status = 'APPROVED'
              AND s.department = :dept

            UNION ALL

            -- 🟠 OUTPASS
            SELECT 
                'OUTPASS',
                o.outpass_id,
                s.name,
                s.reg_no,
                s.department,
                o.created_at
            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.hod_status = 'PENDING'
              AND o.advisor_status = 'APPROVED'
              AND s.department = :dept

            UNION ALL

            -- 🟢 OD
            SELECT 
                'OD',
                o.od_id,
                s.name,
                s.reg_no,
                s.department,
                o.created_at
            FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.hod_status = 'PENDING'
              AND o.advisor_status = 'APPROVED'
              AND s.department = :dept

        ) x
        ORDER BY dt DESC
    """), {"dept": dept}).mappings().all()

    return data


@app.get("/hod/request-breakdown")
def hod_request_breakdown(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    if not payload:
        raise HTTPException(401, "Invalid token")

    email = payload.get("sub") or payload.get("email")

    # Get HOD department
    hod = db.execute(text("""
        SELECT department FROM hods WHERE email = :email
    """), {"email": email}).fetchone()

    if not hod:
        raise HTTPException(403, "Not HOD")

    dept = hod.department

    return {
        "bonafide": db.execute(text("""
            SELECT COUNT(*) FROM bonafide_requests b
            JOIN students s ON s.reg_no = b.reg_no
            WHERE s.department = :dept
            AND b.advisor_status = 'APPROVED'
            AND b.hod_status = 'PENDING'
        """), {"dept": dept}).scalar(),

        "outpass": db.execute(text("""
            SELECT COUNT(*) FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE s.department = :dept
            AND o.advisor_status = 'APPROVED'
            AND o.hod_status = 'PENDING'
        """), {"dept": dept}).scalar(),

        "od": db.execute(text("""
            SELECT COUNT(*) FROM od_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE s.department = :dept
            AND o.advisor_status = 'APPROVED'
            AND o.hod_status = 'PENDING'
        """), {"dept": dept}).scalar(),
    }
@app.get("/hod/history")
def hod_history(payload=Depends(get_current_user_soft), db: Session = Depends(get_db)):
    email = payload.get("sub") or payload.get("email")

    dept = db.execute(
        text("SELECT department FROM hods WHERE email=:e"),
        {"e": email}
    ).scalar()

    data = db.execute(text("""
        SELECT * FROM (
            SELECT 'BONAFIDE' AS type,
                   b.request_id AS id,
                   s.name,
                   s.reg_no,
                   b.hod_status AS status,
                   b.hod_reviewed_at AS acted_on
            FROM bonafide_requests b
            JOIN students s ON s.reg_no=b.reg_no
            WHERE s.department=:dept AND b.hod_status != 'PENDING'

            UNION ALL

            SELECT 'OUTPASS',
                   o.outpass_id,
                   s.name,
                   s.reg_no,
                   o.hod_status,
                   o.hod_reviewed_at
            FROM outpass_requests o
            JOIN students s ON s.reg_no=o.reg_no
            WHERE s.department=:dept AND o.hod_status != 'PENDING'

            UNION ALL

            SELECT 'OD',
                   o.od_id,
                   s.name,
                   s.reg_no,
                   o.hod_status,
                   o.hod_reviewed_at
            FROM od_requests o
            JOIN students s ON s.reg_no=o.reg_no
            WHERE s.department=:dept AND o.hod_status != 'PENDING'
        ) x
        ORDER BY acted_on DESC
    """), {"dept": dept}).mappings().all()

    return data


@app.get("/hod/request/{rtype}/{rid}")
def get_request_detail(rtype: str, rid: int, db: Session = Depends(get_db)):

    if rtype.lower() == "bonafide":
        data = db.execute(text("""
            SELECT b.*, s.name, s.reg_no, s.department
            FROM bonafide_requests b
            JOIN students s ON s.reg_no=b.reg_no
            WHERE b.request_id=:id
        """), {"id": rid}).mappings().first()

    elif rtype.lower() == "outpass":
        data = db.execute(text("""
            SELECT o.*, s.name, s.reg_no, s.department
            FROM outpass_requests o
            JOIN students s ON s.reg_no=o.reg_no
            WHERE o.outpass_id=:id
        """), {"id": rid}).mappings().first()

    elif rtype.lower() == "od":
        data = db.execute(text("""
            SELECT o.*, s.name, s.reg_no, s.department
            FROM od_requests o
            JOIN students s ON s.reg_no=o.reg_no
            WHERE o.od_id=:id
        """), {"id": rid}).mappings().first()

    return data

@app.get("/outpass/detail/{outpass_id}")
def get_outpass_detail(
    outpass_id: int,
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    role = payload.get("role")

    if role not in ["student", "advisor","hod", "warden"]:
        raise HTTPException(403, "Not allowed")
    data = db.execute(
        text("""
            SELECT
                o.outpass_id AS id,
                'outpass' AS type,

                -- 👤 Student Info
                s.name AS studentName,
                s.reg_no AS rollNumber,
                s.department,
                s.email AS studentEmail,
                o.year_of_study,

                -- 📄 Outpass Details
                o.out_date AS outDate,
                o.out_time AS outTime,
                o.in_date AS inDate,
                o.in_time AS inTime,
                o.purpose,
                o.contact_number AS contactNumber,
                o.parent_mobile AS parentContact,

                -- 🏨 Hostel Info
                o.hostel_id AS hostelId,
                o.floor_id AS floorId,
                o.room_no AS roomNumber,

                -- 📊 Status Info
                o.advisor_status AS advisorStatus,
                o.hod_status AS hodStatus,
                o.warden_status AS wardenStatus,

                -- ⏱ Dates
                o.created_at AS createdAt,
                o.hod_reviewed_at AS hodActedAt

            FROM outpass_requests o
            JOIN students s ON s.reg_no = o.reg_no
            WHERE o.outpass_id = :id
        """),
        {"id": outpass_id}
    ).mappings().first()

    if not data:
        raise HTTPException(404, "Outpass request not found")

    return data





@app.get("/bonafide/detail/{request_id}")
def get_bonafide_detail(request_id: int, db: Session = Depends(get_db)):
    data = db.execute(text("""
        SELECT
            b.request_id AS id,
            'bonafide' AS type,
            s.name AS name,
            s.reg_no AS rollNo,
            s.department,
            b.category,
            b.purpose,
            b.applied_at AS submittedAt, 
            b.intern_start_date AS internshipStartDate,
            b.intern_end_date AS internshipEndDate, -- ✅ FIX
            b.hod_status AS status,
            b.advisor_status
        FROM bonafide_requests b
        JOIN students s ON s.reg_no = b.reg_no
        WHERE b.request_id = :id
    """), {"id": request_id}).mappings().first()

    if not data:
        raise HTTPException(404, "Request not found")

    return data



@app.get("/od/detail/{od_id}")
def get_od_detail(od_id: int, db: Session = Depends(get_db)):
    data = db.execute(text("""
        SELECT
            o.od_id AS id,
            'od' AS type,
            s.name AS name,
            s.reg_no AS rollNo,
            s.department,
            o.from_date AS fromDate,        -- ✅ FIX
            o.to_date AS toDate,            -- ✅ FIX
            o.start_time AS startTime,
            o.end_time AS endTime,
            o.place,
            o.purpose,
            o.created_at AS submittedAt,    -- ✅ FIX
            o.hod_status AS status,
            o.advisor_status
        FROM od_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE o.od_id = :id
    """), {"id": od_id}).mappings().first()

    if not data:
        raise HTTPException(404, "Request not found")

    return data

@app.get("/warden/pending-preview")
def warden_pending_preview(payload=Depends(get_current_user_soft), db: Session = Depends(get_db)):
    email = payload.get("sub") or payload.get("email")

    # Only hostel students' outpass + advisor & HOD already approved
    data = db.execute(text("""
        SELECT
            o.outpass_id AS id,
            'outpass' AS type,
            s.name,
            s.reg_no AS rollNo,
            s.department,
            o.out_date AS outDate,
            o.out_time AS outTime,
            o.in_date AS inDate,
            o.in_time AS inTime,
            o.contact_number AS contact,
            o.parent_mobile AS parentMobile,
            o.purpose,
            o.created_at AS submittedAt,
            o.hod_status,
            o.advisor_status,
            o.warden_status
        FROM outpass_requests o
        JOIN students s ON s.reg_no = o.reg_no
        WHERE s.residence_type = 'HOSTEL'
          AND o.advisor_status = 'APPROVED'
          AND o.hod_status = 'APPROVED'
          AND o.warden_status = 'PENDING'
        ORDER BY o.created_at DESC
    """)).mappings().all()

    return data

@app.get("/warden/dashboard-stats")
def warden_dashboard_stats(
    payload=Depends(get_current_user_soft),
    db: Session = Depends(get_db)
):
    email = payload.get("sub") or payload.get("email")

    # (Optional) ensure this user is a warden
    warden = db.execute(
        text("SELECT warden_id FROM wardens WHERE email=:e"),
        {"e": email}
    ).first()

    if not warden:
        raise HTTPException(403, "Not a warden")

    stats = db.execute(text("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE warden_status = 'PENDING') AS pending,
            COUNT(*) FILTER (WHERE warden_status = 'APPROVED') AS approved,
            COUNT(*) FILTER (WHERE warden_status = 'REJECTED') AS rejected
        FROM outpass_requests
        WHERE advisor_status = 'APPROVED' AND hod_status = 'APPROVED'
    """)).mappings().first()

    return stats

@app.get("/warden/history")
def warden_history(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user["role"].lower() != "warden":
        raise HTTPException(403, "Only wardens allowed")

    warden_id = user.get("warden_id")

    data = db.execute(text("""
        SELECT
            o.outpass_id AS id,
            'outpass' AS type,
            s.name AS studentName,
            s.reg_no AS rollNumber,
            s.department,
            o.out_date AS outDate,
            o.in_date AS inDate,
            o.purpose,
            o.warden_status AS status,
            o.created_at AS submittedAt,   -- request created
            o.out_date AS actedAt          -- TEMP: since no updated_at column
        FROM outpass_requests o
        JOIN hostel_floors hf ON hf.floor_id = o.floor_id
        JOIN students s ON s.reg_no = o.reg_no
        WHERE hf.warden_id = :wid
          AND o.hod_status = 'APPROVED'
          AND o.warden_status IN ('APPROVED','REJECTED')
        ORDER BY o.outpass_id DESC
    """), {"wid": warden_id}).mappings().all()

    return data
@app.get("/leave/detail/{leave_id}")
def get_leave_detail(
    leave_id: int,
    payload=Depends(get_current_user_soft),   # works for student & advisor tokens
    db: Session = Depends(get_db)
):

    role = payload.get("role")

    if role not in ["student", "advisor"]:
        raise HTTPException(403, "Not allowed")

    data = db.execute(
        text("""
            SELECT
                l.leave_id AS id,
                'leave' AS type,

                -- 👤 Student Info
                s.name AS studentName,
                s.reg_no AS rollNumber,
                s.department,
                s.email AS studentEmail,

                -- 📄 Leave Details
                l.category,
                l.start_date AS startDate,
                l.end_date AS endDate,
                l.reason,

                -- 📊 Status Info
                l.status,
                l.advisor_remark AS advisorComment,

                -- ⏱ Dates
                l.applied_at AS createdAt,
                l.advisor_reviewed_at AS advisorActedAt

            FROM leave_requests l
            JOIN students s ON s.reg_no = l.reg_no
            WHERE l.leave_id = :id
        """),
        {"id": leave_id}
    ).mappings().first()

    if not data:
        raise HTTPException(404, "Leave request not found")

    return data
