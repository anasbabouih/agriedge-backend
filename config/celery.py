import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-stagnant-requests-every-day': {
        'task': 'apps.notifications.tasks.check_stagnant_requests',
        'schedule': crontab(hour=8, minute=0), # Run every day at 8:00 AM
    },
    'accrue-monthly-leave': {
        'task': 'apps.notifications.tasks.accrue_monthly_leave',
        'schedule': crontab(day_of_month='1', hour=0, minute=0), # 1st of month at midnight
    },
    'rollover-annual-leaves': {
        'task': 'apps.notifications.tasks.rollover_annual_leaves',
        'schedule': crontab(day_of_month='1', month_of_year='1', hour=1, minute=0), # Jan 1st at 1:00 AM
    },
    'leave-reminders-campaign': {
        'task': 'apps.notifications.tasks.send_leave_reminders_campaign',
        'schedule': crontab(day_of_month='1', month_of_year='10,11,12', hour=9, minute=0), # 1st of Oct/Nov/Dec at 9:00 AM
    },
}
