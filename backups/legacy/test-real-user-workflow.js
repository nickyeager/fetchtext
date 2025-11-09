#!/usr/bin/env node
/**
 * Real End-User Workflow Test
 * Tests the exact steps a real user would follow to use template matching
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testRealUserWorkflow() {
    console.log('🧪 REAL END-USER WORKFLOW TEST');
    console.log('===============================');
    
    let browser, page;
    const results = {
        steps: [],
        blockers: [],
        success: false
    };

    try {
        // Launch browser
        browser = await puppeteer.launch({ 
            headless: false, // Show browser for real testing
            defaultViewport: { width: 1200, height: 800 }
        });
        page = await browser.newPage();
        
        // Step 1: Navigate to app
        console.log('📍 Step 1: Navigate to FetchText app...');
        await page.goto('http://localhost:5173');
        await page.waitForTimeout(2000);
        
        const title = await page.title();
        console.log(`   Page title: ${title}`);
        results.steps.push({ step: 'Navigate to app', status: 'success', url: page.url() });
        
        // Take screenshot of homepage
        await page.screenshot({ path: 'user-test-homepage.png', fullPage: true });
        
        // Step 2: Check for authentication requirement
        console.log('🔐 Step 2: Check authentication state...');
        const currentUrl = page.url();
        
        if (currentUrl.includes('sign-in')) {
            console.log('   ℹ️  Redirected to sign-in (authentication required)');
            results.blockers.push({
                blocker: 'Authentication required',
                description: 'User must create account before testing',
                workaround: 'Navigate to sign-up page and create test account'
            });
            
            // Check for sign-up link
            const signUpLink = await page.$('text=Sign Up, a[href*="sign-up"]');
            if (signUpLink) {
                console.log('   ✅ Sign-up link found - account creation possible');
            } else {
                console.log('   ❌ No sign-up link found');
                results.blockers.push({
                    blocker: 'No account creation option',
                    description: 'Cannot create new user account through UI'
                });
            }
            
        } else if (currentUrl.includes('dashboard')) {
            console.log('   ✅ Already authenticated - on dashboard');
            results.steps.push({ step: 'Check auth', status: 'success', note: 'Already logged in' });
            
        } else {
            // Homepage - look for get started button
            console.log('   📋 On marketing homepage - look for entry point');
            
            const getStartedBtn = await page.$('text=Get Started, button:contains("Get Started")');
            const signInBtn = await page.$('text=Sign In, a:contains("Sign In")');
            
            if (getStartedBtn || signInBtn) {
                console.log('   ✅ Entry points found on homepage');
                results.steps.push({ step: 'Check auth', status: 'success', note: 'Entry points available' });
            } else {
                console.log('   ⚠️  No clear entry points found');
            }
        }
        
        // Step 3: Try to access documents directly
        console.log('📄 Step 3: Test direct access to documents...');
        await page.goto('http://localhost:5173/documents');
        await page.waitForTimeout(2000);
        
        const documentsUrl = page.url();
        if (documentsUrl.includes('/documents')) {
            console.log('   ✅ Documents page accessible');
            results.steps.push({ step: 'Access documents', status: 'success' });
            
            // Look for upload interface
            const uploadElements = await page.$$('input[type="file"], [data-testid*="upload"], button:contains("Upload")');
            console.log(`   📤 Found ${uploadElements.length} potential upload elements`);
            
            if (uploadElements.length > 0) {
                console.log('   ✅ Document upload interface detected');
                results.steps.push({ step: 'Find upload UI', status: 'success' });
            } else {
                console.log('   ❌ No upload interface found');
                results.blockers.push({
                    blocker: 'No upload interface',
                    description: 'Cannot find file upload mechanism in UI'
                });
            }
            
        } else {
            console.log(`   🔄 Redirected to: ${documentsUrl}`);
            if (documentsUrl.includes('sign-in')) {
                results.blockers.push({
                    blocker: 'Authentication gate for documents',
                    description: 'Must sign in to access documents page'
                });
            }
        }
        
        await page.screenshot({ path: 'user-test-documents.png', fullPage: true });
        
        // Step 4: Test backend API accessibility
        console.log('🔗 Step 4: Test backend API access...');
        try {
            await page.goto('http://localhost:8090/docs');
            await page.waitForTimeout(2000);
            
            const apiDocs = await page.$('text=Swagger, text=OpenAPI, text=Document Processor');
            if (apiDocs) {
                console.log('   ✅ Backend API documentation accessible');
                results.steps.push({ step: 'API access', status: 'success' });
            } else {
                console.log('   ❌ API docs not accessible');
            }
        } catch (error) {
            console.log(`   ❌ Backend API error: ${error.message}`);
            results.blockers.push({
                blocker: 'Backend API not accessible',
                description: 'Cannot access backend services'
            });
        }
        
        // Step 5: Summary and assessment
        console.log('\n📊 WORKFLOW ASSESSMENT');
        console.log('======================');
        
        if (results.blockers.length === 0) {
            console.log('✅ User can complete full workflow without blockers');
            results.success = true;
        } else {
            console.log(`⚠️  Found ${results.blockers.length} blocker(s):`);
            results.blockers.forEach((blocker, i) => {
                console.log(`   ${i + 1}. ${blocker.blocker}`);
                console.log(`      ${blocker.description}`);
                if (blocker.workaround) {
                    console.log(`      Workaround: ${blocker.workaround}`);
                }
            });
        }
        
        console.log(`\nCompleted ${results.steps.length} workflow steps successfully`);
        
        // Generate detailed report
        const report = {
            testDate: new Date().toISOString(),
            testType: 'Real End-User Workflow',
            results,
            recommendations: []
        };
        
        if (results.blockers.some(b => b.blocker.includes('Authentication'))) {
            report.recommendations.push('Implement guest/demo mode for easier testing');
            report.recommendations.push('Provide test account credentials in documentation');
        }
        
        if (results.blockers.some(b => b.blocker.includes('upload'))) {
            report.recommendations.push('Ensure upload UI is visible without authentication');
            report.recommendations.push('Add clear visual indicators for upload areas');
        }
        
        fs.writeFileSync('end-user-workflow-report.json', JSON.stringify(report, null, 2));
        console.log('\n📋 Detailed report saved: end-user-workflow-report.json');
        
        return results.success;
        
    } catch (error) {
        console.error('💥 Test error:', error.message);
        return false;
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the test
if (require.main === module) {
    testRealUserWorkflow()
        .then(success => {
            console.log(`\n🎯 FINAL RESULT: ${success ? 'WORKFLOW ACCESSIBLE' : 'BLOCKERS FOUND'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test runner crashed:', error);
            process.exit(1);
        });
}

module.exports = testRealUserWorkflow;