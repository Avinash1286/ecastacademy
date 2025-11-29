# Landing Page Image & Media Placeholders

This document describes all the placeholders in the landing page that need screenshots or demo videos from your application.

---

## 📁 Recommended Folder Structure

Create the following folder in your `public` directory:

```
public/
└── images/
    └── landing/
        ├── hero-learnspace.png
        ├── feature-notes.png
        ├── feature-ai-tutor.png
        ├── feature-quiz.png
        ├── feature-capsule.png
        └── feature-certificate.png
```

---

## 🖼️ Required Images

### 1. Hero Section - LearnSpace Interface
**File:** `public/images/landing/hero-learnspace.png`

**Description:** The main hero image showing the LearnSpace interface in action.

**What to capture:**
- The full LearnSpace view with:
  - Video player on the left panel
  - AI Tutor chat OR Notes panel on the right
  - Some visible interaction (a chat message or highlighted notes)
- Include the chapter list sidebar if visible
- Make sure dark theme looks good (or capture both themes)

**Dimensions:** 1200x675px (16:9 aspect ratio)

**Where it's used:** Hero section - Browser mockup

---

### 2. Interactive Notes Feature
**File:** `public/images/landing/feature-notes.png`

**Description:** Screenshot showing AI-generated notes from a video.

**What to capture:**
- The Notes panel expanded
- Show some structured content with:
  - Section headers
  - Key points bullets
  - Maybe a code block or definition
  - Progress indicator if visible

**Dimensions:** 800x500px or 16:9 aspect ratio

**Where it's used:** YouTube Learning / Interactive Notes section

---

### 3. AI Tutor Chat Interface
**File:** `public/images/landing/feature-ai-tutor.png`

**Description:** Screenshot showing the AI Tutor chat interface.

**What to capture:**
- The chat panel with a conversation:
  - A user question
  - An AI response with some markdown formatting
  - Maybe a code snippet or LaTeX equation if applicable
- The input field at the bottom

**Dimensions:** 800x500px or 16:9 aspect ratio

**Where it's used:** AI Tutor section

---

### 4. Interactive Quiz Interface
**File:** `public/images/landing/feature-quiz.png`

**Description:** Screenshot showing a quiz question.

**What to capture:**
- A quiz question with multiple choice options
- Progress bar at the top
- Maybe show one option selected (before submission)
- Include the "Graded" badge if it's a certification quiz

**Dimensions:** 800x500px or 16:9 aspect ratio

**Where it's used:** Interactive Quizzes section

---

### 5. Capsule Learning Interface
**File:** `public/images/landing/feature-capsule.png`

**Description:** Screenshot showing a Capsule lesson.

**What to capture:**
- A Capsule lesson in progress showing one of:
  - A Concept lesson with explanation and visualization
  - A mixed lesson with drag-and-drop or fill-in-the-blanks
  - The simulation/visualization running
- Module progress sidebar visible

**Dimensions:** 800x500px or 16:9 aspect ratio

**Where it's used:** AI Capsules section

---

### 6. Certificate Example
**File:** `public/images/landing/feature-certificate.png`

**Description:** Screenshot of a sample certificate.

**What to capture:**
- A completed certificate with:
  - User name (use a demo name)
  - Course name
  - Completion date
  - Grade percentage
  - The certificate ID
- Make sure no real personal data is shown

**Dimensions:** 800x500px or 16:9 aspect ratio

**Where it's used:** Certification section

---

## 🎥 Optional Video Demos

If you want to add video demos instead of static images, here are suggestions:

### Hero Demo Video
**File:** `public/videos/landing/hero-demo.mp4`
- 15-30 second screen recording
- Show: Paste YouTube URL → Notes generate → Quick chat with AI Tutor
- Keep it smooth and fast-paced

### Capsule Generation Demo
**File:** `public/videos/landing/capsule-demo.mp4`
- Show the capsule generation progress
- Then quickly browse through generated lessons

**Video specs:**
- Format: MP4 (H.264 codec)
- Resolution: 1280x720 or 1920x1080
- Duration: 15-30 seconds
- File size: Keep under 10MB for performance

---

## 🔧 How to Add Images

Once you have the screenshots, update the `LandingPageClient.tsx` file:

### For Hero Image:
Replace the placeholder div in the BrowserMockup:
```tsx
<BrowserMockup url="app.ecastacademy.com/learnspace">
  <img 
    src="/images/landing/hero-learnspace.png" 
    alt="ECAST Academy LearnSpace Interface"
    className="w-full"
  />
</BrowserMockup>
```

### For Feature Images:
Update each `FeatureShowcase` component's `mediaSrc` prop:
```tsx
<FeatureShowcase
  title="Interactive Notes, Automatically Generated"
  // ... other props
  mediaSrc="/images/landing/feature-notes.png"
  mediaAlt="AI-generated notes from video"
/>
```

---

## 🎨 Tips for Great Screenshots

1. **Use dark theme** - It looks more modern and matches tech products
2. **Clean up the data** - Use placeholder/demo content, not real user data
3. **Zoom in slightly** - If the content is too small, zoom the browser to 110-125%
4. **Crop tightly** - Remove browser chrome and focus on the app interface
5. **Consistent sizing** - All feature images should be the same aspect ratio
6. **Optimize images** - Use TinyPNG or similar to compress files

---

## ✅ Checklist

- [ ] `hero-learnspace.png` - LearnSpace main interface
- [ ] `feature-notes.png` - AI-generated notes
- [ ] `feature-ai-tutor.png` - Chat interface
- [ ] `feature-quiz.png` - Quiz question view
- [ ] `feature-capsule.png` - Capsule lesson
- [ ] `feature-certificate.png` - Sample certificate
- [ ] All images optimized (under 500KB each)
- [ ] Images added to `public/images/landing/`
- [ ] `LandingPageClient.tsx` updated with image paths

---

*Last updated: November 29, 2025*
