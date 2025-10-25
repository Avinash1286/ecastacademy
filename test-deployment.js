// TEST SCRIPT - Run this in browser console to verify deployment
// Open DevTools (F12) → Console tab → Paste this code

console.log('🧪 Testing Quiz System Deployment...\n');

// Test 1: Check if Convex API is loaded
if (typeof window !== 'undefined' && window.convex) {
  console.log('✅ Test 1: Convex client loaded');
} else {
  console.log('❌ Test 1: Convex client NOT loaded');
}

// Test 2: Check session
fetch('/api/auth/session')
  .then(res => res.json())
  .then(session => {
    if (session?.user?.id) {
      console.log('✅ Test 2: User authenticated', session.user.email);
      console.log('   User ID:', session.user.id);
    } else {
      console.log('❌ Test 2: User NOT authenticated - Please sign in');
    }
  })
  .catch(err => {
    console.log('❌ Test 2: Error checking auth:', err.message);
  });

// Test 3: Check if on quiz page
const isQuizPage = window.location.pathname.includes('/learnspace/');
if (isQuizPage) {
  console.log('✅ Test 3: On quiz/learnspace page');
  console.log('   URL:', window.location.href);
} else {
  console.log('⚠️  Test 3: Not on quiz page');
  console.log('   Navigate to a quiz to test');
}

// Instructions
console.log('\n📋 Next Steps:');
console.log('1. Make sure Convex is restarted (npx convex dev)');
console.log('2. Navigate to a quiz if not already there');
console.log('3. Complete the quiz');
console.log('4. Check console for "Recording quiz completion" message');
console.log('5. Look for "Completion recorded" success message');
console.log('6. Go to Convex Dashboard → quizAttempts table');
console.log('7. You should see your attempt!');

console.log('\n🔍 Watch for these messages when completing quiz:');
console.log('   - "Recording quiz completion:"');
console.log('   - "Completion recorded:"');
console.log('   - "Showing previous attempt:" (when revisiting)');

console.log('\n✨ All tests complete!');
