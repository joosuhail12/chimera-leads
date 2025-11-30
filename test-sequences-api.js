/**
 * Test script for sequence API endpoints
 * Run with: node test-sequences-api.js
 */

async function testSequenceAPIs() {
  const baseUrl = 'http://localhost:3000/api/sequences';

  // You'll need to get a valid auth token from your browser's dev tools
  // Look for the __clerk_db_jwt cookie or Authorization header
  const authToken = process.env.AUTH_TOKEN || '';

  if (!authToken) {
    console.error('❌ Please set AUTH_TOKEN environment variable');
    console.log('To get your auth token:');
    console.log('1. Open the app in your browser and sign in');
    console.log('2. Open Developer Tools > Application/Storage > Cookies');
    console.log('3. Copy the value of __clerk_db_jwt cookie');
    console.log('4. Run: AUTH_TOKEN="your-token-here" node test-sequences-api.js');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `__clerk_db_jwt=${authToken}`
  };

  console.log('🧪 Testing Sequence APIs...\n');

  try {
    // Test 1: List templates
    console.log('1️⃣ Testing GET /api/sequences/templates');
    const listResponse = await fetch(`${baseUrl}/templates`, { headers });

    if (listResponse.ok) {
      const data = await listResponse.json();
      console.log('✅ List templates successful:', data.templates?.length || 0, 'templates found\n');
    } else {
      console.log('❌ List templates failed:', listResponse.status, await listResponse.text(), '\n');
    }

    // Test 2: Create a template
    console.log('2️⃣ Testing POST /api/sequences/templates');
    const createResponse = await fetch(`${baseUrl}/templates`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Test Cold Outreach Sequence',
        description: 'A test sequence for cold email outreach',
        category: 'cold_outreach',
        settings: {
          pauseOnReply: true,
          pauseOnMeeting: true,
          skipWeekends: true,
          dailyLimit: 50,
          timezone: 'America/New_York'
        }
      })
    });

    let templateId;
    if (createResponse.ok) {
      const data = await createResponse.json();
      templateId = data.template.id;
      console.log('✅ Create template successful:', templateId, '\n');
    } else {
      console.log('❌ Create template failed:', createResponse.status, await createResponse.text(), '\n');
      return;
    }

    // Test 3: Add steps to the template
    console.log('3️⃣ Testing POST /api/sequences/steps');

    const steps = [
      {
        template_id: templateId,
        step_number: 1,
        step_type: 'email',
        wait_days: 0,
        email_subject: 'Quick question about {{company}}',
        email_body: '<p>Hi {{first_name}},</p><p>I noticed that {{company}} is growing rapidly. We help similar companies automate their sales outreach.</p><p>Would you be open to a quick call next week?</p><p>Best,<br>John</p>',
        email_from_name: 'John from Sales'
      },
      {
        template_id: templateId,
        step_number: 2,
        step_type: 'wait',
        wait_days: 3
      },
      {
        template_id: templateId,
        step_number: 3,
        step_type: 'email',
        wait_days: 0,
        email_subject: 'Re: Quick question about {{company}}',
        email_body: '<p>Hi {{first_name}},</p><p>Just wanted to follow up on my previous email. I know you\'re busy, so I\'ll keep this brief.</p><p>We recently helped a similar company increase their sales by 40%. Would love to share how.</p><p>Are you free for a 15-minute call this week?</p><p>Best,<br>John</p>',
        email_from_name: 'John from Sales'
      }
    ];

    for (const step of steps) {
      const stepResponse = await fetch(`${baseUrl}/steps`, {
        method: 'POST',
        headers,
        body: JSON.stringify(step)
      });

      if (stepResponse.ok) {
        console.log(`✅ Added step ${step.step_number}: ${step.step_type}`);
      } else {
        console.log(`❌ Failed to add step ${step.step_number}:`, stepResponse.status);
      }
    }

    console.log('');

    // Test 4: Get template with steps
    console.log('4️⃣ Testing GET /api/sequences/templates/:id');
    const getResponse = await fetch(`${baseUrl}/templates/${templateId}`, { headers });

    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('✅ Get template successful:');
      console.log('   Name:', data.template.name);
      console.log('   Steps:', data.template.steps?.length || 0);
      console.log('');
    } else {
      console.log('❌ Get template failed:', getResponse.status, '\n');
    }

    // Test 5: Test metrics endpoint
    console.log('5️⃣ Testing GET /api/sequences/metrics');
    const metricsResponse = await fetch(`${baseUrl}/metrics`, { headers });

    if (metricsResponse.ok) {
      const data = await metricsResponse.json();
      console.log('✅ Metrics endpoint successful:');
      console.log('   Total Templates:', data.metrics.total_templates);
      console.log('   Active Enrollments:', data.metrics.active_enrollments);
      console.log('');
    } else {
      console.log('❌ Metrics endpoint failed:', metricsResponse.status, '\n');
    }

    console.log('🎉 All API tests completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Visit http://localhost:3000/dashboard/sequences to see your templates');
    console.log('2. Click on a template to enroll leads');
    console.log('3. Set up a cron job to run sequence execution');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testSequenceAPIs();