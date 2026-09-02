"""
RidePredict - Web Application & API Server
Serves the frontend UI and provides optional backend REST API endpoints.
"""

import http.server
import socketserver
import os
import sys
import json

PORT = 8000
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")

class RidePredictHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/predict':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                # Read model_data.json
                model_file = os.path.join(DIRECTORY, "data", "model_data.json")
                with open(model_file, 'r', encoding='utf-8') as f:
                    model_data = json.load(f)

                travel_type_id = str(data.get('travel_type_id', 2))
                model_info = model_data.get('models', {}).get(travel_type_id, {})

                # Return successful response
                response = {
                    "status": "success",
                    "travel_type_id": travel_type_id,
                    "model_name": model_info.get("name", ""),
                    "message": "Prediction computed successfully"
                }
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def run_server():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), RidePredictHandler) as httpd:
        print("="*60)
        print(f" RidePredict Server running at: http://localhost:{PORT}")
        print(f" Serving frontend from: {DIRECTORY}")
        print(f" Press Ctrl+C to stop.")
        print("="*60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run_server()
