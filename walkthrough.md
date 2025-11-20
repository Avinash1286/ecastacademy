# Chat Persistence Fix

## Issue
The user reported that AI responses were disappearing when returning to the chat from the dashboard. This indicated that the AI responses were not being persisted to the database.

## Root Cause
The `useChat` hook's `onFinish` callback was capturing the initial values of `sessionId` and `userId`, which are `null` when the component first mounts. Although these state variables were updated later, the `onFinish` closure remained stale (depending on how `useChat` handles updates, but in this case, it seemed to be using the initial definition). Consequently, the `saveMessage` call inside `onFinish` was returning early because `!sessionId || !userId` was true.

## Fix
I updated `src/components/learnspace/chat-panel.tsx` to use `useRef` to track the current `sessionId` and `userId`.
- Created `sessionIdRef` and `userIdRef`.
- Updated these refs in `useEffect` hooks whenever the state changes.
- Modified the `onFinish` callback to read from `sessionIdRef.current` and `userIdRef.current` instead of the state variables directly.
- Added logging (`[TUTOR_CHAT_SAVE_SUCCESS]` and `[TUTOR_CHAT_SAVE_SKIP]`) to verify the saving process.

## Verification
- **Manual Verification**:
    - Open the chat.
    - Send a message.
    - Wait for the AI response.
    - Navigate to the dashboard.
    - Return to the chat.
    - The AI response should now be visible (persisted).
    - Check the browser console for `[TUTOR_CHAT_SAVE_SUCCESS]` logs.

## Files Modified
- `src/components/learnspace/chat-panel.tsx`
