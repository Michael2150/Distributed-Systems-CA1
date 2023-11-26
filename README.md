## ServerlessREST Assignment - Distributed Systems.

__Name:__ Michael Gerber (20093265)

This repository contains the implementation of a serverless REST API for the AWS platform. A CDK stack creates the infrastructure. The domain context of the API is movie reviews.

### API endpoints.

+ GET /movies - Gets all movie reviews in the database.
+ POST /movies/reviews - Adds a movie review.
+ GET /movies/{movie_id}/reviews - Gets all reviews for a specific movie.
+ GET /movies/{movie_id}/reviews?minRating=n - Gets all reviews for a specific movie with a minimum rating of n.
+ GET /movies/{movie_id}/reviews/{reviewer_name} - Gets a specific review for a movie by a given reviewer.
+ GET /movies/{movie_id}/reviews/{year} - Gets all reviews for a movie from a specific year.
+ PUT /movies/{movie_id}/reviews/{reviewer_name} - (broken) Updates a review for a movie by a given reviewer.
+ GET /movies/{movie_id}/reviews/{reviewer_name}/translation?language=code - (broken) Gets a translated version of a review for a movie by a given reviewer in the specified language.

![image](https://github.com/Michael2150/Distributed-Systems-CA1/assets/52236517/e986acea-0982-46c1-84a1-1fb5f3898101)
![image](https://github.com/Michael2150/Distributed-Systems-CA1/assets/52236517/318a615f-f067-4c14-87ac-ea1c8fadbe5a)

### Authentication.

![image](https://github.com/Michael2150/Distributed-Systems-CA1/assets/52236517/738cb33c-4fea-4f43-ae71-0402c157e9cf)

### Independent learning.

I had to do research on implementing the AWS translating. Unfortunately I could not get it working, but I had to go through AWS documentation to find anything about it.
