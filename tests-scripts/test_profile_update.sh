#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api"

echo -e "${YELLOW}=== Profile Update API Tests ===${NC}\n"

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
    fi
}

# Function to extract token from JSON response
extract_token() {
    echo "$1" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

# Function to extract user data from JSON response
extract_user_field() {
    echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | cut -d'"' -f4
}

# 1. Health Check
echo "1. Testing health check..."
response=$(curl -s "${BASE_URL}/health")
if [[ "$response" == *"OK"* ]]; then
    print_result 0 "Health check endpoint"
else
    print_result 1 "Health check endpoint"
    echo "Response: $response"
fi
echo

# 2. Register a test user
echo "2. Registering test user for profile updates..."
register_response=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testprofileuser","password":"testpass123"}')

if [[ "$register_response" == *"success\":true"* ]]; then
    print_result 0 "Test user registration"
    TEST_TOKEN=$(extract_token "$register_response")
    echo "Token: ${TEST_TOKEN:0:20}..."
else
    print_result 1 "Test user registration"
    echo "Response: $register_response"
    exit 1
fi
echo

# 3. Test profile update - valid username change
echo "3. Testing valid username change..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"username":"updateduser"}')

if [[ "$update_response" == *"success\":true"* ]]; then
    print_result 0 "Valid username change"
    UPDATED_USERNAME=$(extract_user_field "$update_response" "username")
    echo "New username: $UPDATED_USERNAME"
else
    print_result 1 "Valid username change"
    echo "Response: $update_response"
fi
echo

# 4. Test profile update - description change
echo "4. Testing description change..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"description":"This is my updated bio description"}')

if [[ "$update_response" == *"success\":true"* ]]; then
    print_result 0 "Description change"
    UPDATED_DESC=$(extract_user_field "$update_response" "description")
    echo "New description: $UPDATED_DESC"
else
    print_result 1 "Description change"
    echo "Response: $update_response"
fi
echo

# 5. Test profile update - both username and description
echo "5. Testing both username and description change..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"username":"finaluser","description":"Final bio description"}')

if [[ "$update_response" == *"success\":true"* ]]; then
    print_result 0 "Both username and description change"
    FINAL_USERNAME=$(extract_user_field "$update_response" "username")
    FINAL_DESC=$(extract_user_field "$update_response" "description")
    echo "Final username: $FINAL_USERNAME"
    echo "Final description: $FINAL_DESC"
else
    print_result 1 "Both username and description change"
    echo "Response: $update_response"
fi
echo

# 6. Test profile update - no authorization header
echo "6. Testing profile update without authorization..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -d '{"username":"shouldfail"}')

if [[ "$update_response" == *"Authorization token required"* ]]; then
    print_result 0 "Profile update without authorization fails correctly"
else
    print_result 1 "Profile update without authorization fails correctly"
    echo "Response: $update_response"
fi
echo

# 7. Test profile update - invalid token
echo "7. Testing profile update with invalid token..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalidtoken123" \
  -d '{"username":"shouldfail"}')

if [[ "$update_response" == *"Invalid or expired token"* ]]; then
    print_result 0 "Profile update with invalid token fails correctly"
else
    print_result 1 "Profile update with invalid token fails correctly"
    echo "Response: $update_response"
fi
echo

# 8. Test profile update - username too short
echo "8. Testing profile update with username too short..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"username":"ab"}')

if [[ "$update_response" == *"Username must be at least 3 characters long"* ]]; then
    print_result 0 "Username too short validation"
else
    print_result 1 "Username too short validation"
    echo "Response: $update_response"
fi
echo

# 9. Register another user to test username conflict
echo "9. Registering second user to test username conflict..."
register_response2=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"conflictuser","password":"testpass123"}')

if [[ "$register_response2" == *"success\":true"* ]]; then
    print_result 0 "Second user registration"
    CONFLICT_TOKEN=$(extract_token "$register_response2")
else
    print_result 1 "Second user registration"
    echo "Response: $register_response2"
fi
echo

# 10. Test profile update - username conflict
echo "10. Testing profile update with existing username..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONFLICT_TOKEN" \
  -d '{"username":"finaluser"}')

if [[ "$update_response" == *"Username already exists"* ]]; then
    print_result 0 "Username conflict validation"
else
    print_result 1 "Username conflict validation"
    echo "Response: $update_response"
fi
echo

# 11. Test profile update - invalid JSON
echo "11. Testing profile update with invalid JSON..."
update_response=$(curl -s -X PUT "${BASE_URL}/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -d '{"username":"validuser"invalid}')

if [[ "$update_response" == *"Invalid JSON format"* ]]; then
    print_result 0 "Invalid JSON format validation"
else
    print_result 1 "Invalid JSON format validation"
    echo "Response: $update_response"
fi
echo

# 12. Test login with updated credentials
echo "12. Testing login with updated username..."
login_response=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"finaluser","password":"testpass123"}')

if [[ "$login_response" == *"success\":true"* ]]; then
    print_result 0 "Login with updated username"
    LOGIN_DESC=$(extract_user_field "$login_response" "description")
    echo "Retrieved description: $LOGIN_DESC"
else
    print_result 1 "Login with updated username"
    echo "Response: $login_response"
fi
echo

echo -e "${YELLOW}=== Profile Update Tests Complete ===${NC}" 