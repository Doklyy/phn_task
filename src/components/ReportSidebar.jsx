import { useState } from 'react';
import './ReportSidebar.css';

const initialForm = { date: '', content: '', result: '', note: '' };

export function ReportSidebar({ isOpen, onClose }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.date.trim()) e.date = 'Vui lòng chọn ngày.';
    if (!form.content.trim()) e.content = 'Nội dung báo cáo không được để trống.';
    if (form.content.trim().length < 10) e.content = 'Nội dung tối thiểu 10 ký tự.';
    if (!form.result.trim()) e.result = 'Kết quả không được để trống.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
    console.log('Báo cáo kết quả ngày:', form);
    setTimeout(() => {
      setForm(initialForm);
      setErrors({});
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="report-sidebar-overlay" onClick={onClose}>
      <aside className="report-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h2>Báo cáo kết quả ngày</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label htmlFor="report-date">Ngày báo cáo <span className="required">*</span></label>
            <input
              id="report-date"
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => handleChange('date', e.target.value)}
              className={errors.date ? 'invalid' : ''}
            />
            {errors.date && <span className="error-msg">{errors.date}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="report-content">Nội dung công việc <span className="required">*</span></label>
            <textarea
              id="report-content"
              rows={3}
              placeholder="Mô tả ngắn công việc đã làm (tối thiểu 10 ký tự)"
              value={form.content}
              onChange={(e) => handleChange('content', e.target.value)}
              className={errors.content ? 'invalid' : ''}
            />
            {errors.content && <span className="error-msg">{errors.content}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="report-result">Kết quả đạt được <span className="required">*</span></label>
            <textarea
              id="report-result"
              rows={2}
              placeholder="Kết quả cụ thể"
              value={form.result}
              onChange={(e) => handleChange('result', e.target.value)}
              className={errors.result ? 'invalid' : ''}
            />
            {errors.result && <span className="error-msg">{errors.result}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="report-note">Ghi chú</label>
            <input
              id="report-note"
              type="text"
              placeholder="Tùy chọn"
              value={form.note}
              onChange={(e) => handleChange('note', e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={submitted}>
              {submitted ? 'Đã gửi ✓' : 'Gửi báo cáo'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
