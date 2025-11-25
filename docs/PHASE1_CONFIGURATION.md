# Capsule Generation - Phase 1 Configuration

## Environment Variables

Add these to your `.env.local` file to control the new unified pipeline:

```bash
# Feature Flags for Unified Pipeline (Phase 1)

# Enable the new unified single-pass generation pipeline
# Default: false (uses existing LangChain 3-phase pipeline)
USE_UNIFIED_PIPELINE=false

# Rollout percentage for unified pipeline (0-100)
# Users are selected based on stable hash of their userId
# 0 = disabled, 100 = all users, 25 = 25% of users
# Default: 0
UNIFIED_ROLLOUT_PERCENTAGE=0

# Quality threshold for generated capsules (0.0-1.0)
# Capsules below this threshold will be flagged for review
# Default: 0.7
QUALITY_THRESHOLD=0.7

# Existing AI Configuration (unchanged)
GEMINI_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
```

## Phase 1 Testing Plan

### Step 1: Local Testing (Week 1)
Set up for local development testing:

```bash
# Enable unified pipeline for all local requests
USE_UNIFIED_PIPELINE=true
UNIFIED_ROLLOUT_PERCENTAGE=100
QUALITY_THRESHOLD=0.7
```

**Test Cases:**
1. Generate capsule from topic (simple)
2. Generate capsule from topic (complex with guidance)
3. Generate capsule from PDF (small, <10 pages)
4. Generate capsule from PDF (large, >50 pages)

**Success Criteria:**
- ✅ Generation completes successfully
- ✅ Quality score >= 0.7
- ✅ Token usage < 100K for topics
- ✅ All lessons render correctly in UI
- ✅ No validation errors

### Step 2: Canary Testing (Week 1-2)
Gradual rollout to real users:

```bash
# Enable for 10% of users
USE_UNIFIED_PIPELINE=true
UNIFIED_ROLLOUT_PERCENTAGE=10
```

**Monitoring:**
- Compare token usage: unified vs. langchain
- Compare generation time: unified vs. langchain
- Compare quality scores
- Monitor error rates
- User feedback/completion rates

**Success Criteria:**
- ✅ Error rate < 5%
- ✅ Token usage reduction > 40%
- ✅ Quality scores comparable or better
- ✅ No user complaints

### Step 3: Expanded Rollout (Week 2)
If canary successful:

```bash
# Increase to 50% of users
UNIFIED_ROLLOUT_PERCENTAGE=50
```

Continue monitoring same metrics.

### Step 4: Full Rollout (End of Week 2)
If all metrics positive:

```bash
# Enable for all users
UNIFIED_ROLLOUT_PERCENTAGE=100
```

## Rollback Plan

If issues detected:

```bash
# Immediate rollback to LangChain pipeline
USE_UNIFIED_PIPELINE=false
# or
UNIFIED_ROLLOUT_PERCENTAGE=0
```

No code deployment needed - just environment variable change.

## Monitoring Metrics

### Key Metrics to Track

**Performance:**
- Average token usage (target: 50K-100K)
- Average generation time (target: 25-50s)
- API calls per generation (target: 1-2)

**Quality:**
- Quality score distribution
- Content richness score
- Code validity score
- Schema compliance rate

**Reliability:**
- Success rate (target: >95%)
- Fallback rate (target: <5%)
- Error types and frequencies

**Business:**
- Cost per capsule (target: <$0.35)
- User satisfaction (completion rates)
- Generation volume

### How to Access Metrics

Check your application logs for these events:

```json
{
  "event": "capsule_generation_metrics",
  "tokensUsed": 75000,
  "duration": 32000,
  "apiCalls": 1,
  "method": "unified",
  "timestamp": "2025-11-24T12:00:00Z"
}

{
  "event": "quality_assessment",
  "overall": "0.850",
  "metrics": {
    "contentRichness": "0.920",
    "codeValidity": "0.950",
    "schemaCompliance": "1.000",
    "interactivity": "0.600",
    "accessibility": "0.800"
  },
  "issueCount": 1,
  "passesThreshold": true
}
```

## Feature Comparison

| Aspect | LangChain (Current) | Unified (New) | Improvement |
|--------|---------------------|---------------|-------------|
| **API Calls** | 3-8 calls | 1-2 calls | 75% fewer |
| **Token Usage** | 150K-400K | 50K-150K | 60% less |
| **Generation Time** | 40-80s | 25-50s | 35% faster |
| **Cost per Capsule** | ~$0.50 | ~$0.35 | 30% cheaper |
| **Code Complexity** | 3-phase pipeline | Single-pass | Simpler |
| **Validation** | AI repair (5+ calls) | Local fix (0 calls) | 80% fewer repair calls |
| **Quality Control** | Implicit | Explicit scoring | Better visibility |

## Next Steps After Phase 1

Once Phase 1 is stable (unified pipeline at 100%):

**Phase 2 (Week 3-4):** Prompt optimization
- Compress prompts further
- Implement source material summarization
- Add smart caching

**Phase 3 (Week 5):** Code cleanup
- Remove `shared/ai/capsuleGeneration.ts`
- Remove `shared/ai/capsuleRollout.ts`
- Consolidate rate limiting

**Phase 4 (Week 6-8):** Advanced features
- Streaming generation
- Progressive enhancement
- Incremental module generation

## FAQ

**Q: What happens if unified pipeline fails?**
A: Automatic fallback to LangChain pipeline. User sees no error.

**Q: Can I test unified pipeline for specific users?**
A: Yes, the rollout uses stable hashing based on userId. Same user always gets same pipeline.

**Q: How do I know if unified pipeline is working?**
A: Check logs for "pipeline: unified" in generation events.

**Q: What if quality scores are too low?**
A: Adjust QUALITY_THRESHOLD or enhance local validation fixes in `validationEnhanced.ts`.

**Q: Can I disable unified pipeline instantly?**
A: Yes, set `USE_UNIFIED_PIPELINE=false` or `UNIFIED_ROLLOUT_PERCENTAGE=0`.
