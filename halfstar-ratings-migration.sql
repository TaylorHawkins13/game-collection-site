-- Lets ratings go in 0.5 steps (e.g. 3.5, 4.5) instead of only whole
-- stars. Widens the column from a whole-number int to a one-decimal
-- numeric, and swaps the "0 to 5" check for one that also rejects
-- anything that isn't a multiple of 0.5.
alter table games alter column rating drop default;
alter table games alter column rating type numeric(2,1) using rating::numeric(2,1);
alter table games alter column rating set default 0;

alter table games drop constraint if exists games_rating_check;
alter table games add constraint games_rating_check
  check (rating >= 0 and rating <= 5 and mod(rating * 10, 5) = 0);
