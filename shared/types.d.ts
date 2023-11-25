export type Review = {
  author: string;
  content: string;
  created_at: string;
  id: string;
  movie_id: number;
  rating: number;
};

export type UpdateReviewInput = {
  content: string;
};
