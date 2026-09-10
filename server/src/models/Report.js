const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema(
  {
    reporterSessionId: { type: String, required: true, index: true },
    reportedSessionId: { type: String, required: true, index: true },
    reason: {
      type: String,
      required: true,
      enum: ['harassment', 'nudity', 'hate-speech', 'spam', 'threats', 'other'],
    },
    details: { type: String, default: '', maxlength: 500 },
    roomId: { type: String, default: '' },
  },
  { timestamps: true }
);

ReportSchema.index({ reporterSessionId: 1, reportedSessionId: 1, createdAt: -1 });
ReportSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Report || mongoose.model('Report', ReportSchema);
