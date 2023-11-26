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

export type SignUpBody = {
  username: string;
  password: string;
  email: string
}
export type ConfirmSignUpBody = {
  username: string;
  code: string;
}
export type SignInBody = {
  username: string;
  password: string;
}