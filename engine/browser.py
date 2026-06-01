"""Browser/stealth plumbing."""
import random
import psutil

try:
    from fake_useragent import UserAgent
    ua = UserAgent(platforms=['pc'])
except ImportError:
    ua = None

try:
    from playwright.async_api import async_playwright
    from playwright_stealth import Stealth
    stealth_helper = Stealth()
except ImportError:
    async_playwright = None
    stealth_helper = None


async def abort_useless_requests(route):
    if route.request.resource_type in ["image", "stylesheet", "media", "font"]:
        await route.abort()
    else:
        await route.fallback()


async def create_stealth_context(browser):
    user_agent = ua.random if ua else 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    context = await browser.new_context(
        viewport={'width': random.randint(1280, 1920), 'height': random.randint(800, 1080)},
        user_agent=user_agent,
        locale='en-US',
        timezone_id='Asia/Kolkata',
        java_script_enabled=True,
        ignore_https_errors=True,
    )
    return context


def cleanup_orphaned_browsers():
    try:
        killed = 0
        for proc in psutil.process_iter(['pid', 'exe']):
            try:
                exe = proc.exe()
                if exe and 'ms-playwright' in exe.lower():
                    proc.kill()
                    killed += 1
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        return killed
    except Exception:
        return 0
