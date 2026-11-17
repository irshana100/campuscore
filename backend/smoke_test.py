from app import create_app

app = create_app()
client = app.test_client()

health = client.get('/api/health')
print('HEALTH', health.status_code, health.get_json())

login = client.post('/api/auth/login', json={'email': 'student1@college.edu', 'password': 'student123'})
print('LOGIN', login.status_code, login.get_json())

token = login.get_json().get('token')
if token:
    dash = client.get('/api/dashboard', headers={'Authorization': f'Bearer {token}'})
    print('DASHBOARD', dash.status_code, dash.get_json()['role'])
    notifs = client.get('/api/notifications', headers={'Authorization': f'Bearer {token}'})
    print('NOTIFICATIONS', notifs.status_code, len(notifs.get_json()['notifications']))
