import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.json.JSONObject;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.Base64;

public class AttendanceServer {
    private static final String DB_URL = "jdbc:mysql://localhost:3306/company_db?useSSL=false";
    private static final String DB_USER = "root"; // Replace with your MySQL username
    private static final String DB_PASSWORD = "zeeshankhan"; // Replace with your MySQL password

    public static void main(String[] args) throws Exception {
        // Initialize database connection
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            System.out.println("Connected to database");
        } catch (SQLException e) {
            System.err.println("Database connection failed: " + e.getMessage());
            return;
        }

        //InetSocketAddress address = new InetSocketAddress("0.0.0.0", 8000);
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/api/signup", new SignupHandler());
        server.createContext("/api/login", new LoginHandler());
        server.createContext("/api/attendance", new AttendanceHandler("Attendance"));
        server.createContext("/api/exit", new AttendanceHandler("Exit"));
        server.createContext("/api/save-location", new LocationHandler());
        server.createContext("/", new RootHandler());
        server.setExecutor(null);
        server.start();
        System.out.println("Server started on port 8080");
    }

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int length;
        while ((length = is.read(buffer)) != -1) {
            result.write(buffer, 0, length);
        }
        return result.toString(StandardCharsets.UTF_8);
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }

    static class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String requestPath = exchange.getRequestURI().getPath();
            String filePath = "src/web/";
            String contentType = "text/html";

            if (requestPath.equals("/") || requestPath.equals("/index.html")) {
                filePath += "index.html";
            } else if (requestPath.equals("/styles.css")) {
                filePath += "styles.css";
                contentType = "text/css";
            } else if (requestPath.equals("/script.js")) {
                filePath += "script.js";
                contentType = "text/javascript";
            } else {
                sendResponse(exchange, 404, "{\"status\":\"error\",\"message\":\"File not found\"}");
                return;
            }

            File file = new File(filePath);
            if (!file.exists()) {
                sendResponse(exchange, 404, "{\"status\":\"error\",\"message\":\"" + filePath + " not found\"}");
                return;
            }

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, file.length());
            try (OutputStream os = exchange.getResponseBody(); FileInputStream fis = new FileInputStream(file)) {
                byte[] buffer = new byte[1024];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                }
            }
        }
    }

    static class SignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"status\":\"error\",\"message\":\"Method not allowed\"}");
                return;
            }

            String requestBody = readRequestBody(exchange);
            System.out.println("Signup Request Body: " + requestBody);
            JSONObject json;
            try {
                json = new JSONObject(requestBody);
            } catch (Exception e) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid JSON: " + e.getMessage() + "\"}");
                return;
            }

            String username = json.optString("username");
            String password = json.optString("password");

            if (username.isEmpty() || password.isEmpty()) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Username and password required\"}");
                return;
            }

            try (Connection conn = getConnection()) {
                // Check if username exists
                String checkSql = "SELECT sys_user_id FROM sys_user WHERE name = ?";
                try (PreparedStatement stmt = conn.prepareStatement(checkSql)) {
                    stmt.setString(1, username);
                    ResultSet rs = stmt.executeQuery();
                    if (rs.next()) {
                        sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Username already exists\"}");
                        return;
                    }
                }

                // Insert new user (password stored as plain text for simplicity; use hashing in production)
                String insertSql = "INSERT INTO sys_user (name, password, organization_id, active_lookup_id) VALUES (?, ?, ?, ?)";
                try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                    stmt.setString(1, username);
                    stmt.setString(2, password); // TODO: Hash password
                    stmt.setInt(3, 1); // Default organization_id
                    stmt.setInt(4, 1); // Assume active (1 = active)
                    stmt.executeUpdate();
                }

                sendResponse(exchange, 200, "{\"status\":\"success\",\"message\":\"Signup successful\"}");
            } catch (SQLException e) {
                sendResponse(exchange, 500, "{\"status\":\"error\",\"message\":\"Database error: " + e.getMessage() + "\"}");
            }
        }
    }

    static class LoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"status\":\"error\",\"message\":\"Method not allowed\"}");
                return;
            }

            String requestBody = readRequestBody(exchange);
            System.out.println("Login Request Body: " + requestBody);
            JSONObject json;
            try {
                json = new JSONObject(requestBody);
            } catch (Exception e) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid JSON: " + e.getMessage() + "\"}");
                return;
            }

            String username = json.optString("username");
            String password = json.optString("password");

            try (Connection conn = getConnection()) {
                String sql = "SELECT sys_user_id, password FROM sys_user WHERE name = ?";
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setString(1, username);
                    ResultSet rs = stmt.executeQuery();
                    if (rs.next() && rs.getString("password").equals(password)) { // TODO: Compare hashed password
                        sendResponse(exchange, 200, "{\"status\":\"success\",\"message\":\"Login successful\",\"username\":\"" + username + "\"}");
                    } else {
                        sendResponse(exchange, 401, "{\"status\":\"error\",\"message\":\"Invalid credentials\"}");
                    }
                }
            } catch (SQLException e) {
                sendResponse(exchange, 500, "{\"status\":\"error\",\"message\":\"Database error: " + e.getMessage() + "\"}");
            }
        }
    }

    static class AttendanceHandler implements HttpHandler {
        private final String type;

        public AttendanceHandler(String type) {
            this.type = type;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"status\":\"error\",\"message\":\"Method not allowed\"}");
                return;
            }

            String requestBody = readRequestBody(exchange);
            System.out.println("Attendance Request Body: " + requestBody);
            JSONObject json;
            try {
                json = new JSONObject(requestBody);
            } catch (Exception e) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid JSON: " + e.getMessage() + "\"}");
                return;
            }

            String username = json.optString("username");
            String location = json.optString("location");
            String signature = json.optString("signature");
            String image = json.optString("image");
            String description = json.optString("description", "");
            JSONObject deviceInfo = json.optJSONObject("deviceInfo");
            String imei = json.optString("imei", "Not Available");
            double latitude = json.optDouble("latitude", Double.NaN);
            double longitude = json.optDouble("longitude", Double.NaN);

            if (username.isEmpty()) {
                sendResponse(exchange, 401, "{\"status\":\"error\",\"message\":\"Invalid user\"}");
                return;
            }
            if (location.isEmpty() || signature.isEmpty() || image.isEmpty()) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Missing required fields\"}");
                return;
            }
            if (Double.isNaN(latitude) || Double.isNaN(longitude)) {
                try {
                    String[] latLon = location.split(",");
                    latitude = Double.parseDouble(latLon[0].trim());
                    longitude = Double.parseDouble(latLon[1].trim());
                } catch (Exception e) {
                    sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid location format\"}");
                    return;
                }
            }

            try (Connection conn = getConnection()) {
                // Verify user
                String userSql = "SELECT sys_user_id FROM sys_user WHERE name = ?";
                int sysUserId;
                try (PreparedStatement stmt = conn.prepareStatement(userSql)) {
                    stmt.setString(1, username);
                    ResultSet rs = stmt.executeQuery();
                    if (!rs.next()) {
                        sendResponse(exchange, 401, "{\"status\":\"error\",\"message\":\"Invalid user\"}");
                        return;
                    }
                    sysUserId = rs.getInt("sys_user_id");
                }

                // Get attendance type ID
                String typeSql = "SELECT attendance_type_lookup_id FROM attendance_type_lookup WHERE type_name = ?";
                int attendanceTypeId;
                try (PreparedStatement stmt = conn.prepareStatement(typeSql)) {
                    stmt.setString(1, type);
                    ResultSet rs = stmt.executeQuery();
                    if (!rs.next()) {
                        sendResponse(exchange, 500, "{\"status\":\"error\",\"message\":\"Invalid attendance type\"}");
                        return;
                    }
                    attendanceTypeId = rs.getInt("attendance_type_lookup_id");
                }

                // Fetch address and weather (simplified; reuse frontend data if provided)
                String address = "Fetched address"; // TODO: Integrate Nominatim API if needed
                String weather = "Sunny, 28°C"; // TODO: Integrate weather API if needed

                // Insert attendance record
                String insertSql = "INSERT INTO attendance_log (sys_user_id, attendance_type_lookup_id, attendance_time, latitude, longitude, address, weather, signature, selfie_picture, organization_id) " +
                        "VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)";
                try (PreparedStatement stmt = conn.prepareStatement(insertSql)) {
                    stmt.setInt(1, sysUserId);
                    stmt.setInt(2, attendanceTypeId);
                    stmt.setDouble(3, latitude);
                    stmt.setDouble(4, longitude);
                    stmt.setString(5, address);
                    stmt.setString(6, weather);
                    stmt.setString(7, signature);
                    stmt.setString(8, image);
                    stmt.setInt(9, 1); // Default organization_id
                    stmt.executeUpdate();
                }

                sendResponse(exchange, 200, "{\"status\":\"success\",\"message\":\"" + type + " marked\"}");
            } catch (SQLException e) {
                sendResponse(exchange, 500, "{\"status\":\"error\",\"message\":\"Database error: " + e.getMessage() + "\"}");
            }
        }
    }

    static class LocationHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendResponse(exchange, 405, "{\"status\":\"error\",\"message\":\"Method not allowed\"}");
                return;
            }

            String requestBody = readRequestBody(exchange);
            System.out.println("Location Save Request Body: " + requestBody);
            JSONObject json;
            try {
                json = new JSONObject(requestBody);
            } catch (Exception e) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid JSON: " + e.getMessage() + "\"}");
                return;
            }

            String username = json.optString("username");
            String name = json.optString("name");
            double latitude = json.optDouble("latitude", Double.NaN);
            double longitude = json.optDouble("longitude", Double.NaN);

            if (username.isEmpty()) {
                sendResponse(exchange, 401, "{\"status\":\"error\",\"message\":\"Invalid user\"}");
                return;
            }
            if (name.isEmpty()) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Location name required\"}");
                return;
            }
            if (Double.isNaN(latitude) || latitude < -90 || latitude > 90) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid latitude (-90 to 90 required)\"}");
                return;
            }
            if (Double.isNaN(longitude) || longitude < -180 || longitude > 180) {
                sendResponse(exchange, 400, "{\"status\":\"error\",\"message\":\"Invalid longitude (-180 to 180 required)\"}");
                return;
            }

            try (Connection conn = getConnection()) {
                // Verify user and update their location
                String sql = "UPDATE sys_user SET latitude = ?, longitude = ?, address = ? WHERE name = ?";
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setDouble(1, latitude);
                    stmt.setDouble(2, longitude);
                    stmt.setString(3, name);
                    stmt.setString(4, username);
                    int rows = stmt.executeUpdate();
                    if (rows == 0) {
                        sendResponse(exchange, 401, "{\"status\":\"error\",\"message\":\"Invalid user\"}");
                        return;
                    }
                }

                sendResponse(exchange, 200, "{\"status\":\"success\",\"message\":\"Location saved successfully\"}");
            } catch (SQLException e) {
                sendResponse(exchange, 500, "{\"status\":\"error\",\"message\":\"Database error: " + e.getMessage() + "\"}");
            }
        }
    }
}