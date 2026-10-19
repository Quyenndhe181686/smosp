import { useState } from 'react'
import {
  Loader2, CheckCircle2, XCircle, Ban, Lock,
  AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react'
import { PHASE_META, jobProgressPercent } from './crawlJobMeta'
import './CrawlJobList.css'

/**
 * Bảng theo dõi tiến trình các phiên thu thập dữ liệu.
 *
 * Dùng chung cho màn Content Manager (TrendingWeightPage) và màn Admin
 * (DataCrawlerConfigPage) — hai màn theo dõi CÙNG một pipeline nên phải hiện
 * cùng một thứ. Tách ra đây thay vì chép JSX sang màn thứ hai: chép thì lần sửa
 * sau (thêm bước, đổi nhãn, sửa cách tính %) chỉ áp một bên và hai màn lệch nhau
 * lúc nào không hay.
 *
 * Component này THUẦN HIỂN THỊ: không tự gọi API, không tự poll. Mỗi màn tự lo
 * lấy dữ liệu rồi truyền `jobs` vào, vì cách lấy khác nhau — màn CM dựng từ
 * pipeline nó tự khởi động, màn Admin poll danh sách phiên đang chạy.
 *
 * @param {Array} jobs   [{ batchId, label, phase, batch, normalize, error }]
 * @param {Function} onCancel  bấm Dừng một phiên; bỏ trống thì không hiện nút
 * @param {Array} cancellingIds  batchId đang gửi yêu cầu dừng
 */

export default function CrawlJobList({ jobs = [], onCancel, cancellingIds = [] }) {
  const [expandedJobs, setExpandedJobs] = useState({})

  if (jobs.length === 0) return null

  return (
    <div
      className={`cjl-jobs${jobs.length > 3 ? ' cjl-jobs--tall' : ''}`}
      title="Kéo mép dưới bên phải để phóng to hoặc thu nhỏ khung theo dõi"
    >
      {jobs.map(job => {
        const meta = PHASE_META[job.phase] || PHASE_META.CRAWL
        const percent = jobProgressPercent(job)
        const crawlErrors = job.batch?.totalErrors || 0
        const breakdown = (job.normalize?.breakdown || [])
          .filter(item => (item.success || 0) > 0)
          .sort((a, b) => (b.success || 0) - (a.success || 0))
        // Batch phủ nhiều CNH mới cần breakdown; 1 CNH thì số tổng đã đủ.
        const showBreakdown = breakdown.length > 1
        const expanded = Boolean(expandedJobs[job.batchId])

        let detail = ''
        if (job.phase === 'CRAWL' && job.batch) {
          const expected = job.batch.totalExpected
          detail = expected
            ? `${job.batch.totalFetched || 0}/${expected} tin`
            : `${job.batch.totalFetched || 0} tin`
        } else if (job.phase === 'NORMALIZE' && job.normalize) {
          detail = `còn ${job.normalize.pending || 0} · xong ${job.normalize.success || 0}`
        } else if (job.phase === 'FAILED') {
          detail = job.error || ''
        }

        /* Phiên của người khác: hiện tên để biết ai đang giữ, thay vì tưởng hệ
           thống treo. Backend đã tính sẵn canCancel nên FE không tự suy luận quyền. */
        const owner = job.batch?.triggeredByName
        const isOthers = owner && job.batch?.canCancel === false && meta.running
        const canCancel = Boolean(onCancel) && job.batch?.canCancel === true
        const cancelPending = job.batch?.cancelRequested === true && meta.running

        return (
          <div className="cjl-job" key={job.batchId}>
            <div className="cjl-job-head">
              <span className="cjl-job-name" title={job.label}>{job.label}</span>
              <div className="cjl-job-right">
                {isOthers && (
                  <span className="cjl-job-owner" title={`Phiên này do ${owner} chạy — bạn không dừng được`}>
                    <Lock size={10} /> {owner}
                  </span>
                )}
                {cancelPending && <span className="cjl-job-meta">đang dừng…</span>}
                {canCancel && !cancelPending && (
                  <button
                    type="button"
                    className="cjl-job-stop"
                    onClick={() => onCancel(job.batchId)}
                    disabled={cancellingIds.includes(job.batchId)}
                    title="Dừng phiên thu thập dữ liệu này"
                  >
                    <XCircle size={11} />
                    {cancellingIds.includes(job.batchId) ? 'Đang gửi…' : 'Dừng'}
                  </button>
                )}
                {detail && <span className="cjl-job-meta">{detail}</span>}
                {crawlErrors > 0 && (
                  <span
                    className="cjl-err-badge"
                    title={`${crawlErrors} page bị lỗi khi thu thập — dữ liệu vẫn dùng được, chỉ thiếu phần lỗi`}
                  >
                    <AlertTriangle size={10} /> {crawlErrors} lỗi
                  </span>
                )}
                <span className={`cjl-phase ${meta.cls}`}>
                  {meta.running && <Loader2 size={11} className="cjl-spin" />}
                  {job.phase === 'DONE' && <CheckCircle2 size={11} />}
                  {job.phase === 'FAILED' && <XCircle size={11} />}
                  {job.phase === 'CANCELLED' && <Ban size={11} />}
                  {meta.label}
                </span>
              </div>
            </div>

            {/* Ly do dung — quan trong nhat voi nguoi BI dung: phien cua ho tu
                nhien chet, day la cho duy nhat giai thich ai dung va vi sao. */}
            {job.phase === 'CANCELLED' && (job.batch?.cancelReason || job.batch?.cancelledByName) && (
              <div className="cjl-cancel-note">
                <Ban size={11} />
                <span>
                  {job.batch?.cancelledByName
                    ? <><strong>{job.batch.cancelledByName}</strong> đã dừng phiên này</>
                    : 'Phiên này đã bị dừng'}
                  {job.batch?.cancelReason ? ` — ${job.batch.cancelReason}` : ''}
                </span>
              </div>
            )}

            {job.phase !== 'FAILED' && (
              <div className="cjl-progress">
                <div className="cjl-progress-track">
                  <div
                    className={`cjl-progress-fill${percent === null ? ' cjl-progress-fill--unknown' : ''}`}
                    style={{ width: percent === null ? '100%' : `${percent}%` }}
                  />
                </div>
                <span className="cjl-progress-pct">
                  {percent === null ? '—' : `${percent}%`}
                </span>
              </div>
            )}

            {showBreakdown && (
              <div className="cjl-breakdown">
                <button
                  type="button"
                  className="cjl-breakdown-toggle"
                  onClick={() => setExpandedJobs(prev => ({ ...prev, [job.batchId]: !prev[job.batchId] }))}
                >
                  {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  {breakdown.length} chuyên ngành hẹp đã có dữ liệu
                </button>
                {expanded && (
                  <div className="cjl-breakdown-list">
                    {breakdown.map(item => (
                      <div className="cjl-breakdown-row" key={item.narrowSpecId}>
                        <span
                          className="cjl-breakdown-name"
                          title={item.narrowSpecName || item.narrowSpecCode}
                        >
                          {item.narrowSpecName || item.narrowSpecCode}
                        </span>
                        <span className="cjl-breakdown-count">{item.success} job</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
