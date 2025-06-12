#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000/api"

echo -e "${YELLOW}=== Blog Posts API Tests ===${NC}\n"

# Generate unique username with current datetime
DATETIME=$(date +%Y%m%d_%H%M%S)
TEST_USER="bloguser_${DATETIME}"
TEST_USER2="author2_${DATETIME}"

echo -e "${BLUE}Using test usernames: $TEST_USER and $TEST_USER2${NC}\n"

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

# Function to extract post ID from JSON response
extract_post_id() {
    echo "$1" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4
}

# 1. Health Check
echo "1. Testing API health check..."
response=$(curl -s "${BASE_URL}/health")
if [[ "$response" == *"OK"* ]]; then
    print_result 0 "API health check"
else
    print_result 1 "API health check"
    echo "Response: $response"
fi
echo

# 2. Register first test user
echo "2. Registering first test user ($TEST_USER)..."
register_response=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"testpass123\"}")

if [[ "$register_response" == *"success\":true"* ]]; then
    print_result 0 "First user registration"
    USER1_TOKEN=$(extract_token "$register_response")
    echo "Token: ${USER1_TOKEN:0:20}..."
else
    print_result 1 "First user registration"
    echo "Response: $register_response"
    exit 1
fi
echo

# 3. Register second test user
echo "3. Registering second test user ($TEST_USER2)..."
register_response2=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER2\",\"password\":\"testpass123\"}")

if [[ "$register_response2" == *"success\":true"* ]]; then
    print_result 0 "Second user registration"
    USER2_TOKEN=$(extract_token "$register_response2")
    echo "Token: ${USER2_TOKEN:0:20}..."
else
    print_result 1 "Second user registration"
    echo "Response: $register_response2"
    exit 1
fi
echo

# 4. Test creating post without authentication
echo "4. Testing post creation without authentication..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","content":"This should fail"}')

if [[ "$create_response" == *"Authorization token required"* ]]; then
    print_result 0 "Post creation without auth fails correctly"
else
    print_result 1 "Post creation without auth fails correctly"
    echo "Response: $create_response"
fi
echo

# 5. Test creating valid post
echo "5. Testing valid post creation..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"title":"My First Blog Post","description":"This is a test post","content":"This is the content of my first blog post. It contains multiple sentences and should be long enough to test the content validation.","published":true}')

if [[ "$create_response" == *"success\":true"* ]]; then
    print_result 0 "Valid post creation"
    POST1_ID=$(extract_post_id "$create_response")
    echo "Created post with slug: $(echo "$create_response" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)"
else
    print_result 1 "Valid post creation"
    echo "Response: $create_response"
fi
echo

# 6. Test creating post with invalid data
echo "6. Testing post creation with invalid data..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"title":"","content":"Valid content"}')

if [[ "$create_response" == *"Title is required"* ]]; then
    print_result 0 "Invalid post data validation"
else
    print_result 1 "Invalid post data validation"
    echo "Response: $create_response"
fi
echo

# 7. Test creating draft post
echo "7. Testing draft post creation..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"title":"My Draft Post","content":"This is a draft post that should not appear in public listings.","published":false}')

if [[ "$create_response" == *"success\":true"* ]]; then
    print_result 0 "Draft post creation"
    DRAFT_POST_ID=$(extract_post_id "$create_response")
else
    print_result 1 "Draft post creation"
    echo "Response: $create_response"
fi
echo

# 8. Test creating post by second user
echo "8. Testing post creation by second user..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -d '{"title":"Another Author Post","description":"Post by second author","content":"This post is created by the second author to test multi-user functionality.","published":true}')

if [[ "$create_response" == *"success\":true"* ]]; then
    print_result 0 "Second user post creation"
    POST2_ID=$(extract_post_id "$create_response")
else
    print_result 1 "Second user post creation"
    echo "Response: $create_response"
fi
echo

# 9. Test getting all published posts
echo "9. Testing get all published posts..."
get_response=$(curl -s "${BASE_URL}/posts")

if [[ "$get_response" == *"success\":true"* && "$get_response" == *"My First Blog Post"* && "$get_response" == *"Another Author Post"* ]]; then
    print_result 0 "Get all published posts"
    echo "Found $(echo "$get_response" | grep -o '"total":[0-9]*' | cut -d':' -f2) published posts"
else
    print_result 1 "Get all published posts"
    echo "Response: ${get_response:0:200}..."
fi
echo

# 10. Test getting posts by specific user
echo "10. Testing get posts by user ($TEST_USER)..."
get_response=$(curl -s "${BASE_URL}/posts/user/$TEST_USER")

if [[ "$get_response" == *"success\":true"* && "$get_response" == *"My First Blog Post"* ]]; then
    print_result 0 "Get posts by specific user"
else
    print_result 1 "Get posts by specific user"
    echo "Response: ${get_response:0:200}..."
fi
echo

# 11. Test updating post by author
echo "11. Testing post update by author..."
update_response=$(curl -s -X PUT "${BASE_URL}/posts/$POST1_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"title":"My Updated Blog Post","description":"Updated description","content":"This is the updated content of my blog post."}')

if [[ "$update_response" == *"success\":true"* && "$update_response" == *"My Updated Blog Post"* ]]; then
    print_result 0 "Post update by author"
else
    print_result 1 "Post update by author"
    echo "Response: $update_response"
fi
echo

# 12. Test updating post by non-author
echo "12. Testing post update by non-author..."
update_response=$(curl -s -X PUT "${BASE_URL}/posts/$POST1_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -d '{"title":"Unauthorized Update"}')

if [[ "$update_response" == *"Not authorized to edit this post"* ]]; then
    print_result 0 "Post update by non-author fails correctly"
else
    print_result 1 "Post update by non-author fails correctly"
    echo "Response: $update_response"
fi
echo

# 13. Test getting specific post
echo "13. Testing get specific post..."
get_response=$(curl -s "${BASE_URL}/posts/$POST1_ID")

if [[ "$get_response" == *"success\":true"* && "$get_response" == *"My Updated Blog Post"* ]]; then
    print_result 0 "Get specific post"
else
    print_result 1 "Get specific post"
    echo "Response: ${get_response:0:200}..."
fi
echo

# 14. Test deleting post by non-author
echo "14. Testing post deletion by non-author..."
delete_response=$(curl -s -X DELETE "${BASE_URL}/posts/$POST2_ID" \
  -H "Authorization: Bearer $USER1_TOKEN")

if [[ "$delete_response" == *"Not authorized to delete this post"* ]]; then
    print_result 0 "Post deletion by non-author fails correctly"
else
    print_result 1 "Post deletion by non-author fails correctly"
    echo "Response: $delete_response"
fi
echo

# 15. Test deleting post by author
echo "15. Testing post deletion by author..."
delete_response=$(curl -s -X DELETE "${BASE_URL}/posts/$POST2_ID" \
  -H "Authorization: Bearer $USER2_TOKEN")

if [[ "$delete_response" == *"success\":true"* ]]; then
    print_result 0 "Post deletion by author"
else
    print_result 1 "Post deletion by author"
    echo "Response: $delete_response"
fi
echo

# 16. Test getting deleted post
echo "16. Testing get deleted post..."
get_response=$(curl -s "${BASE_URL}/posts/$POST2_ID")

if [[ "$get_response" == *"Post not found"* ]]; then
    print_result 0 "Deleted post not found"
else
    print_result 1 "Deleted post not found"
    echo "Response: $get_response"
fi
echo

# 17. Test content length validation
echo "17. Testing content length validation..."
long_content=$(printf 'a%.0s' {1..50001})  # 50,001 characters
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d "{\"title\":\"Long Content Test\",\"content\":\"$long_content\"}")

if [[ "$create_response" == *"Content must be 50,000 characters or less"* ]]; then
    print_result 0 "Content length validation"
else
    print_result 1 "Content length validation"
    echo "Response: $create_response"
fi
echo

# 18. Test title length validation
echo "18. Testing title length validation..."
long_title=$(printf 'a%.0s' {1..201})  # 201 characters
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d "{\"title\":\"$long_title\",\"content\":\"Valid content\"}")

if [[ "$create_response" == *"Title must be 200 characters or less"* ]]; then
    print_result 0 "Title length validation"
else
    print_result 1 "Title length validation"
    echo "Response: $create_response"
fi
echo

# 19. Test slug generation
echo "19. Testing slug generation with special characters..."
create_response=$(curl -s -X POST "${BASE_URL}/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -d '{"title":"Hello, World! & Special Characters @#$%","content":"Testing slug generation with special characters.","published":true}')

if [[ "$create_response" == *"success\":true"* ]]; then
    SLUG=$(echo "$create_response" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)
    if [[ "$SLUG" == "hello-world-special-characters" ]]; then
        print_result 0 "Slug generation with special characters"
        echo "Generated slug: $SLUG"
    else
        print_result 1 "Slug generation with special characters"
        echo "Expected: hello-world-special-characters, Got: $SLUG"
    fi
else
    print_result 1 "Slug generation test post creation"
    echo "Response: $create_response"
fi
echo

# 20. Test pagination
echo "20. Testing pagination..."
get_response=$(curl -s "${BASE_URL}/posts?page=1&limit=2")

if [[ "$get_response" == *"success\":true"* ]]; then
    print_result 0 "Pagination support"
    echo "Retrieved posts with pagination"
else
    print_result 1 "Pagination support"
    echo "Response: ${get_response:0:200}..."
fi
echo

echo -e "${YELLOW}=== Blog Posts API Tests Complete ===${NC}"
echo -e "${BLUE}Test completed with users: $TEST_USER and $TEST_USER2${NC}" 