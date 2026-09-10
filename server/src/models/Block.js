const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema(
  {
    blockerSessionId: { type: String, required: true, index: true },
    blockedSessionId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

BlockSchema.index({ blockerSessionId: 1, blockedSessionId: 1 }, { unique: true });

module.exports = mongoose.models.Block || mongoose.model('Block', BlockSchema);
