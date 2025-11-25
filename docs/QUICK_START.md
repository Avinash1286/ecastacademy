# 🚀 Quick Start Guide - Phase 1 Unified Pipeline

Get started with the new unified capsule generation pipeline in 5 minutes!

---

## Step 1: Configure Environment (1 min)

Add to your `.env.local` file:

```bash
# Enable unified pipeline
USE_UNIFIED_PIPELINE=true

# Test with all requests locally (100%)
UNIFIED_ROLLOUT_PERCENTAGE=100

# Set quality threshold
QUALITY_THRESHOLD=0.7

# Your existing API keys
GEMINI_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
```

---

## Step 2: Start Your Dev Server (30 sec)

```bash
# Install dependencies if needed
npm install

# Start Convex
npx convex dev

# Start Next.js (in another terminal)
npm run dev
```

---

## Step 3: Test Generation (2 min)

### Test 1: Topic-based Generation
1. Navigate to capsule creation page
2. Select "Topic"
3. Enter: "Introduction to React Hooks"
4. Click "Generate"
5. Watch console logs for: `"pipeline": "unified"`

### Test 2: PDF-based Generation
1. Select "PDF Upload"
2. Upload a small PDF (< 10 pages recommended)
3. Click "Generate"
4. Check console logs

---

## Step 4: Verify Metrics (1 min)

### Check Console Logs

You should see:

```json
// Pipeline Selection
{
  "capsuleId": "...",
  "useUnifiedPipeline": true,
  "rolloutPercentage": 100
}

// Generation Metrics
{
  "event": "capsule_generation_metrics",
  "tokensUsed": 85000,
  "duration": 32000,
  "apiCalls": 1,
  "method": "unified"
}

// Quality Assessment
{
  "event": "quality_assessment",
  "overall": "0.850",
  "passesThreshold": true
}
```

### Expected Results
- ✅ Generation completes in 25-50 seconds
- ✅ Quality score ≥ 0.7
- ✅ Lessons render correctly
- ✅ No validation errors

---

## Step 5: Compare with Legacy (Optional)

### Test Both Pipelines

**Unified Pipeline:**
```bash
USE_UNIFIED_PIPELINE=true
```

**LangChain Pipeline (Legacy):**
```bash
USE_UNIFIED_PIPELINE=false
```

### Use Comparison Tool

```bash
# Collect logs and analyze
node scripts/compareMetrics.ts
```

---

## 🎯 Success Indicators

### ✅ Working Correctly If:
- Console shows "pipeline: unified"
- Generation completes successfully
- Quality score ≥ 0.7
- Token usage 50K-150K
- Duration 25-50 seconds
- Lessons display properly

### ⚠️ Issues If:
- Fallback to LangChain happening frequently
- Quality scores consistently < 0.6
- Validation errors in console
- Generation failures

---

## 🔧 Troubleshooting

### Pipeline Not Activating

**Problem:** Logs show "pipeline: langchain" instead of "unified"

**Solutions:**
```bash
# Verify environment variables
echo $USE_UNIFIED_PIPELINE  # Should be "true"
echo $UNIFIED_ROLLOUT_PERCENTAGE  # Should be "100"

# Restart dev server
# Kill and restart both Convex and Next.js
```

### Low Quality Scores

**Problem:** Quality assessment shows scores < 0.7

**Solutions:**
1. Check if content has placeholders
2. Review generated lessons manually
3. Adjust threshold if needed:
```bash
QUALITY_THRESHOLD=0.6  # More lenient
```

### Validation Errors

**Problem:** Console shows validation errors

**Check:**
1. Error details in logs
2. Which validation stage failed
3. Whether local fixes were attempted

**Fix:**
- Most errors should auto-fix
- If persistent, report the error pattern

### Generation Failures

**Problem:** Generation fails completely

**Check:**
1. API keys are valid
2. Model is available
3. Error message in console

**Fallback:**
- System should auto-fallback to LangChain
- If not, set `USE_UNIFIED_PIPELINE=false`

---

## 📊 Monitor Performance

### Real-time Monitoring

Watch console logs for:
- Token usage trending
- Quality scores distribution
- API call counts
- Generation duration

### Compare Metrics

Run after several generations:
```bash
node scripts/compareMetrics.ts
```

Look for:
- 60%+ token reduction
- 75%+ fewer API calls
- 35%+ faster generation

---

## 🚦 Production Deployment

### Gradual Rollout Recommended

**Week 1: Canary (10%)**
```bash
USE_UNIFIED_PIPELINE=true
UNIFIED_ROLLOUT_PERCENTAGE=10
```

**Week 2: Expanded (50%)**
```bash
UNIFIED_ROLLOUT_PERCENTAGE=50
```

**Week 3: Full (100%)**
```bash
UNIFIED_ROLLOUT_PERCENTAGE=100
```

### Monitoring in Production

Watch for:
- Error rate < 5%
- Fallback rate < 5%
- Quality scores ≥ 0.7
- User satisfaction maintained

---

## 🔙 Rollback Plan

### Instant Rollback

If any issues:

```bash
# Disable unified pipeline immediately
USE_UNIFIED_PIPELINE=false

# OR set rollout to 0
UNIFIED_ROLLOUT_PERCENTAGE=0
```

No code changes needed - just environment variable!

---

## 📝 Example Output

### Console Log (Successful Generation)

```
[Capsule] Pipeline selection { useUnifiedPipeline: true, rolloutPercentage: 100 }
[Capsule] Unified generation starting...
[Capsule] Progress: initializing
[Capsule] Progress: generating
[Capsule] Progress: validating
[Capsule] ✅ Applied 3 local fixes: ["Added default for modules[0].description", ...]
[Capsule] ✅ Validation succeeded after local fixes
[Capsule] Progress: completed
[Capsule] Quality assessment: { overall: 0.85, passesThreshold: true }
[Capsule] Unified pipeline metrics: { tokensUsed: 85000, qualityScore: 0.85, apiCalls: 1 }
[Capsule] Generated 3 modules with 11 lessons
```

### Generated Capsule Structure

```json
{
  "title": "Introduction to React Hooks",
  "description": "Master React Hooks for modern component development",
  "estimatedDuration": 45,
  "modules": [
    {
      "title": "Getting Started with Hooks",
      "lessons": [
        { "lessonType": "concept", ... },
        { "lessonType": "mcq", ... },
        { "lessonType": "simulation", ... }
      ]
    }
  ]
}
```

---

## 🎓 Next Steps

### After Successful Testing

1. ✅ Verify all lesson types render
2. ✅ Complete 5+ test generations
3. ✅ Review quality scores
4. ✅ Compare token usage
5. ✅ Plan production rollout

### Learn More

- `PHASE1_CONFIGURATION.md` - Detailed setup guide
- `PHASE1_IMPLEMENTATION.md` - Technical details
- `PHASE1_SUMMARY.md` - Complete overview
- `imp.md` - Full improvement plan

---

## ✨ Key Features at a Glance

| Feature | Benefit |
|---------|---------|
| **Single-pass generation** | 75% fewer API calls |
| **Optimized prompts** | 60% token reduction |
| **Local validation** | 80% fewer repair calls |
| **Quality scoring** | Explicit quality control |
| **Feature flags** | Safe, gradual rollout |
| **Auto-fallback** | Zero-downtime reliability |

---

## 🆘 Need Help?

1. Check this guide first
2. Review `PHASE1_CONFIGURATION.md`
3. Search logs for error details
4. Use `compareMetrics.ts` for analysis

---

**Ready to start?** Just add those 3 environment variables and generate your first capsule!

*Total setup time: < 5 minutes* ⚡
